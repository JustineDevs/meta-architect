import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ensureDir, readJson, writeFileIfMissing, writeJson } from "../fs-utils.js";
import { getRuntimeSubsystemPath } from "../paths.js";
import { agentRegistry, sanitizeSkillName } from "./skills-registry-export.js";

export const universalPluginBrokerSchemaVersion = "0.1.0";
export const universalPluginManifestSchemaVersion = "0.1.0";

const mcpInjectorHosts = ["claude-code", "antigravity", "cursor", "codex"];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function quoteTomlString(value) {
  return JSON.stringify(`${value}`);
}

function dedupe(values) {
  return [...new Set(values)];
}

function mcpServerNameForPlugin(pluginName) {
  const safeName = sanitizeSkillName(pluginName);
  const baseName = safeName.startsWith("ma-") ? safeName.slice(3) : safeName;
  return `ma-plugin-${baseName}`;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function directoryExists(targetPath) {
  try {
    return (await fs.stat(targetPath)).isDirectory();
  } catch {
    return false;
  }
}

async function readJsonOrDefault(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return structuredClone(fallback);
  }
}

async function writeJsonConfig(filePath, config) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(config, null, 2)}\n`);
}

function cursorStoragePath({
  home = os.homedir(),
  platform = process.platform,
  env = process.env,
} = {}) {
  if (platform === "win32") {
    return path.join(
      env.APPDATA || path.join(home, "AppData", "Roaming"),
      "Cursor",
      "User",
      "globalStorage",
      "storage.json",
    );
  }
  if (platform === "darwin") {
    return path.join(
      home,
      "Library",
      "Application Support",
      "Cursor",
      "User",
      "globalStorage",
      "storage.json",
    );
  }
  return path.join(home, ".config", "Cursor", "User", "globalStorage", "storage.json");
}

function createMcpDefinition({ manifest, pluginDir, wrapperPath, useWrapper = true }) {
  const manifestArgs = asArray(manifest.mcp?.args).map((arg) =>
    `${arg}`.replaceAll("{{PLUGIN_DIR}}", pluginDir),
  );
  if (useWrapper) {
    return {
      command: wrapperPath,
      args: [],
    };
  }
  return {
    command: manifest.mcp.command,
    args: manifestArgs,
  };
}

function renderWrapperScript({ manifest, pluginDir }) {
  const args = asArray(manifest.mcp?.args).map((arg) =>
    `${arg}`.replaceAll("{{PLUGIN_DIR}}", pluginDir),
  );
  if (manifest.mcp.command === "node" && args.length > 0) {
    const [entrypoint, ...rest] = args;
    const quotedRest = rest.map((arg) => `"${arg.replaceAll('"', '\\"')}"`).join(" ");
    return `#!/usr/bin/env sh\nexec node "${entrypoint.replaceAll('"', '\\"')}" ${quotedRest} "$@"\n`;
  }
  const quotedArgs = args.map((arg) => `"${arg.replaceAll('"', '\\"')}"`).join(" ");
  return `#!/usr/bin/env sh\nexec "${manifest.mcp.command.replaceAll('"', '\\"')}" ${quotedArgs} "$@"\n`;
}

export function getUniversalPluginBrokerCorePath() {
  return getRuntimeSubsystemPath("context", "universal-plugin-broker-core.json");
}

export function createDefaultUniversalPluginBrokerCore() {
  const supportedAgents = Object.keys(agentRegistry).sort();
  return {
    schemaVersion: universalPluginBrokerSchemaVersion,
    product: "Meta-Architect",
    purpose:
      "Defines the MA-owned hybrid plugin contract: universal MCP tooling plus vendor-agnostic MA skill context payloads across supported host agents.",
    architecture: {
      tooling_layer: {
        protocol: "MCP stdio JSON-RPC",
        server_contract: "ma-manifest.json#mcp",
        usable_by: mcpInjectorHosts,
      },
      context_layer: {
        canonical_skill_dir: ".agents/skills",
        prompt_contract: "ma-manifest.json#ma_roles",
        usable_by: supportedAgents,
      },
    },
    lifecycle: ["resolve", "isolate", "generate", "mutate"],
    mutation_policy: {
      may_write_vendor_configs: true,
      writes_only_detected_or_requested_hosts: true,
      may_mutate_release_state: false,
      may_mutate_decisions: false,
      records_as: "plugin_compatibility_configuration",
      never_records_as: "build_evidence",
      requires_session_reload_for: ["claude-code", "antigravity", "codex"],
    },
    supported_agents: supportedAgents,
    mcp_injector_hosts: mcpInjectorHosts,
  };
}

export function validateUniversalPluginBrokerCore(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("universal plugin broker core must be an object");
  }
  if (value.schemaVersion !== universalPluginBrokerSchemaVersion) {
    throw new Error(`Unsupported universal plugin broker schemaVersion: ${value.schemaVersion}`);
  }
  if (value.mutation_policy?.may_mutate_release_state !== false) {
    throw new Error("plugin broker must not mutate release state");
  }
  if (value.mutation_policy?.may_mutate_decisions !== false) {
    throw new Error("plugin broker must not mutate decisions");
  }
  if (value.mutation_policy?.records_as !== "plugin_compatibility_configuration") {
    throw new Error("plugin broker must record as plugin_compatibility_configuration");
  }
  if (value.mutation_policy?.never_records_as !== "build_evidence") {
    throw new Error("plugin broker must never record as build_evidence");
  }
  for (const host of mcpInjectorHosts) {
    if (!value.mcp_injector_hosts?.includes(host)) {
      throw new Error(`plugin broker missing MCP injector host: ${host}`);
    }
  }
  return value;
}

export async function seedUniversalPluginBrokerCoreArtifacts() {
  await ensureDir(getRuntimeSubsystemPath("context"));
  await writeFileIfMissing(
    getUniversalPluginBrokerCorePath(),
    `${JSON.stringify(createDefaultUniversalPluginBrokerCore(), null, 2)}\n`,
  );
}

export async function loadUniversalPluginBrokerCore() {
  return validateUniversalPluginBrokerCore(await readJson(getUniversalPluginBrokerCorePath()));
}

export function createUniversalPluginManifest({
  name,
  version = "0.1.0",
  description = "",
  entrypoint,
  mcp = null,
  ma_roles: maRoles = {},
}) {
  const safeName = sanitizeSkillName(name);
  if (!safeName) {
    throw new Error("plugin manifest requires name");
  }
  const normalizedMcp = mcp ?? {
    command: "node",
    args: ["{{PLUGIN_DIR}}/dist/index.js"],
  };
  return validateUniversalPluginManifest({
    schemaVersion: universalPluginManifestSchemaVersion,
    name: safeName,
    version,
    description,
    entrypoint,
    mcp: {
      command: normalizedMcp.command,
      args: asArray(normalizedMcp.args),
    },
    ma_roles: {
      bind: dedupe(asArray(maRoles.bind)),
      prompt_injection_file: maRoles.prompt_injection_file ?? null,
    },
  });
}

export function validateUniversalPluginManifest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("plugin manifest must be an object");
  }
  const name = sanitizeSkillName(value.name);
  if (!name) {
    throw new Error("plugin manifest requires name");
  }
  if (typeof value.version !== "string" || value.version.trim() === "") {
    throw new Error("plugin manifest requires version");
  }
  if (typeof value.entrypoint !== "string" || value.entrypoint.trim() === "") {
    throw new Error("plugin manifest requires entrypoint");
  }
  if (typeof value.mcp?.command !== "string" || value.mcp.command.trim() === "") {
    throw new Error("plugin manifest requires mcp.command");
  }
  if (!Array.isArray(value.mcp?.args)) {
    throw new Error("plugin manifest requires mcp.args array");
  }
  const roleBindings = asArray(value.ma_roles?.bind);
  for (const role of roleBindings) {
    if (typeof role !== "string" || !role.startsWith("$")) {
      throw new Error("plugin manifest role bindings must use MA trigger names such as $vet");
    }
  }
  return {
    schemaVersion: value.schemaVersion ?? universalPluginManifestSchemaVersion,
    name,
    version: value.version,
    description: value.description ?? "",
    entrypoint: value.entrypoint,
    mcp: {
      command: value.mcp.command,
      args: value.mcp.args.map((arg) => `${arg}`),
    },
    ma_roles: {
      bind: dedupe(roleBindings),
      prompt_injection_file: value.ma_roles?.prompt_injection_file ?? null,
    },
  };
}

export async function loadUniversalPluginManifest(sourceDir) {
  return validateUniversalPluginManifest(await readJson(path.join(sourceDir, "ma-manifest.json")));
}

export function renderUniversalMcpServerTemplate({
  serverName = "ma-plugin-universal-executor",
  toolName = "execute_plugin_action",
} = {}) {
  return `import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const server = new Server({ name: ${JSON.stringify(serverName)}, version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: ${JSON.stringify(toolName)},
    description: "Executes plugin logic through MA-compatible MCP stdio.",
    inputSchema: {
      type: "object",
      properties: {
        targetFilePath: { type: "string" },
        payload: { type: "string" }
      },
      required: ["targetFilePath", "payload"]
    }
  }]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== ${JSON.stringify(toolName)}) throw new Error("Tool not found");
  const { targetFilePath, payload } = request.params.arguments;
  return { content: [{ type: "text", text: JSON.stringify({ status: "success", targetFilePath, payload }) }] };
});

await server.connect(new StdioServerTransport());
`;
}

export function renderPluginContextSkillMd(manifest) {
  const plugin = validateUniversalPluginManifest(manifest);
  const serverName = mcpServerNameForPlugin(plugin.name);
  const roles = plugin.ma_roles.bind.length > 0 ? plugin.ma_roles.bind : ["$maestro"];
  return [
    "---",
    `name: ${serverName}`,
    `description: ${plugin.description || `MA universal plugin context payload for ${plugin.name}`}`,
    "---",
    "",
    `# ${serverName}`,
    "",
    "This is a Meta-Architect universal plugin context payload.",
    "",
    "## Role Binding",
    "",
    ...roles.map((role) => `- ${role}`),
    "",
    "## Execution Contract",
    "",
    `- MCP server name: \`${serverName}\``,
    "- Use the MCP tool only when the active MA lane selects this plugin as task-relevant.",
    "- Route authoritative state changes through `$maestro` or the owning lane.",
    "- Do not mutate `.ma/release.json`, `.ma/decisions.json`, `.ma/plans/`, or `.ma/specs/` directly.",
    "- Record plugin output as `plugin_compatibility_configuration` or lane-scoped context, never as `build_evidence`.",
    "- If the host MCP client was already running, report that `/reload-mcp` or a session restart may be required.",
    "",
  ].join("\n");
}

export async function writePluginContextSkill({ manifest, home = os.homedir() }) {
  const plugin = validateUniversalPluginManifest(manifest);
  const serverName = mcpServerNameForPlugin(plugin.name);
  const skillDir = path.join(home, ".agents", "skills", serverName);
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(path.join(skillDir, "SKILL.md"), renderPluginContextSkillMd(plugin));
  await writeJson(path.join(skillDir, "ma-plugin-manifest.json"), plugin);
  const receipt = {
    schemaVersion: universalPluginBrokerSchemaVersion,
    record_type: "plugin_context_skill_receipt",
    plugin: plugin.name,
    skill: serverName,
    path: skillDir,
    records_as: "plugin_compatibility_configuration",
    build_evidence: false,
  };
  await writeJson(path.join(skillDir, "ma-plugin-broker-receipt.json"), receipt);
  return receipt;
}

export async function detectInstalledPluginHosts({
  home = os.homedir(),
  platform = process.platform,
  env = process.env,
} = {}) {
  const hosts = [];
  if (
    (await pathExists(path.join(home, ".claude.json"))) ||
    (await directoryExists(path.join(home, ".claude")))
  ) {
    hosts.push("claude-code");
  }
  if (await directoryExists(path.join(home, ".antigravity"))) {
    hosts.push("antigravity");
  }
  if (
    (await pathExists(cursorStoragePath({ home, platform, env }))) ||
    (await directoryExists(path.dirname(cursorStoragePath({ home, platform, env }))))
  ) {
    hosts.push("cursor");
  }
  if (await directoryExists(path.join(home, ".codex"))) {
    hosts.push("codex");
  }
  return hosts;
}

export async function injectClaudeCodeMcpServer({
  home = os.homedir(),
  serverName,
  command,
  args,
}) {
  const claudeJsonPath = path.join(home, ".claude.json");
  if (!(await pathExists(claudeJsonPath)) && !(await directoryExists(path.join(home, ".claude")))) {
    return { host: "claude-code", status: "skipped", reason: "Claude Code config not detected" };
  }
  const config = await readJsonOrDefault(claudeJsonPath, {});
  config.mcpServers = config.mcpServers ?? {};
  config.mcpServers[serverName] = { command, args };
  await writeJsonConfig(claudeJsonPath, config);
  return { host: "claude-code", status: "configured", path: claudeJsonPath };
}

export async function injectAntigravityMcpServer({
  home = os.homedir(),
  serverName,
  command,
  args,
}) {
  const antigravityRoot = path.join(home, ".antigravity");
  if (!(await directoryExists(antigravityRoot))) {
    return {
      host: "antigravity",
      status: "skipped",
      reason: "Antigravity config root not detected",
    };
  }
  const configPath = path.join(antigravityRoot, "config.toml");
  const existing = (await fs.readFile(configPath, "utf8").catch(() => "")).trimEnd();
  const marker = `name = ${quoteTomlString(serverName)}`;
  if (existing.includes(marker)) {
    return { host: "antigravity", status: "configured", path: configPath, idempotent: true };
  }
  const argList = `[${args.map((arg) => quoteTomlString(arg)).join(", ")}]`;
  const block = [
    "",
    "[[mcp_servers]]",
    `name = ${quoteTomlString(serverName)}`,
    `command = ${quoteTomlString(command)}`,
    `args = ${argList}`,
    'env = ["NODE_ENV=production"]',
    "",
  ].join("\n");
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, `${existing}${block}`);
  return { host: "antigravity", status: "configured", path: configPath };
}

export async function injectCursorMcpServer({
  home = os.homedir(),
  platform = process.platform,
  env = process.env,
  serverName,
  command,
  args,
}) {
  const settingsPath = cursorStoragePath({ home, platform, env });
  if (!(await pathExists(settingsPath)) && !(await directoryExists(path.dirname(settingsPath)))) {
    return { host: "cursor", status: "skipped", reason: "Cursor storage not detected" };
  }
  const storage = await readJsonOrDefault(settingsPath, {});
  storage["mcp.mcpServers"] = storage["mcp.mcpServers"] ?? {};
  storage["mcp.mcpServers"][serverName] = {
    name: serverName,
    type: "command",
    command: [command, ...args.map((arg) => `"${arg.replaceAll('"', '\\"')}"`)].join(" ").trim(),
    enabled: true,
  };
  await writeJsonConfig(settingsPath, storage);
  return { host: "cursor", status: "configured", path: settingsPath };
}

export async function injectCodexMcpServer({ home = os.homedir(), serverName, command, args }) {
  const codexRoot = path.join(home, ".codex");
  if (!(await directoryExists(codexRoot))) {
    return { host: "codex", status: "skipped", reason: "Codex config root not detected" };
  }
  const configPath = path.join(codexRoot, "config.toml");
  const existing = (await fs.readFile(configPath, "utf8").catch(() => "")).trimEnd();
  const header = `[mcp_servers.${quoteTomlString(serverName)}]`;
  if (existing.includes(header)) {
    return { host: "codex", status: "configured", path: configPath, idempotent: true };
  }
  const argList = `[${args.map((arg) => quoteTomlString(arg)).join(", ")}]`;
  const block = ["", header, `command = ${quoteTomlString(command)}`, `args = ${argList}`, ""].join(
    "\n",
  );
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, `${existing}${block}`);
  return { host: "codex", status: "configured", path: configPath };
}

export async function injectPluginToVendors({
  manifest,
  pluginDir,
  wrapperPath,
  home = os.homedir(),
  targets = null,
  platform = process.platform,
  env = process.env,
  useWrapper = true,
} = {}) {
  const plugin = validateUniversalPluginManifest(manifest);
  const selectedTargets = targets ?? (await detectInstalledPluginHosts({ home, platform, env }));
  const serverName = mcpServerNameForPlugin(plugin.name);
  const definition = createMcpDefinition({ manifest: plugin, pluginDir, wrapperPath, useWrapper });
  const receipts = [];
  for (const target of selectedTargets) {
    if (target === "claude-code") {
      receipts.push(await injectClaudeCodeMcpServer({ home, serverName, ...definition }));
    } else if (target === "antigravity") {
      receipts.push(await injectAntigravityMcpServer({ home, serverName, ...definition }));
    } else if (target === "cursor") {
      receipts.push(
        await injectCursorMcpServer({ home, platform, env, serverName, ...definition }),
      );
    } else if (target === "codex") {
      receipts.push(await injectCodexMcpServer({ home, serverName, ...definition }));
    } else {
      receipts.push({ host: target, status: "skipped", reason: "No MA MCP injector for host" });
    }
  }
  return {
    record_type: "vendor_manifest_injection",
    plugin: plugin.name,
    serverName,
    mcp: definition,
    receipts,
    configured_hosts: receipts
      .filter((receipt) => receipt.status === "configured")
      .map((receipt) => receipt.host),
    records_as: "plugin_compatibility_configuration",
    build_evidence: false,
  };
}

export async function installUniversalPlugin({
  sourceDir,
  home = os.homedir(),
  targets = null,
  platform = process.platform,
  env = process.env,
  useWrapper = true,
} = {}) {
  if (!sourceDir) {
    throw new Error("installUniversalPlugin requires sourceDir");
  }
  const manifest = await loadUniversalPluginManifest(sourceDir);
  const sourceEntrypoint = path.join(sourceDir, manifest.entrypoint);
  if (!(await pathExists(sourceEntrypoint))) {
    throw new Error(`Plugin entrypoint missing: ${manifest.entrypoint}`);
  }
  const pluginDir = path.join(home, ".ma", "plugins", manifest.name);
  const wrapperPath = path.join(home, ".ma", "bin", mcpServerNameForPlugin(manifest.name));
  await fs.mkdir(path.dirname(pluginDir), { recursive: true });
  await fs.rm(pluginDir, { recursive: true, force: true });
  await fs.cp(sourceDir, pluginDir, { recursive: true });
  await fs.mkdir(path.dirname(wrapperPath), { recursive: true });
  await fs.writeFile(wrapperPath, renderWrapperScript({ manifest, pluginDir }));
  await fs.chmod(wrapperPath, 0o755);
  const contextSkillReceipt = await writePluginContextSkill({ manifest, home });
  const vendorInjection = await injectPluginToVendors({
    manifest,
    pluginDir,
    wrapperPath,
    home,
    targets,
    platform,
    env,
    useWrapper,
  });
  return {
    schemaVersion: universalPluginBrokerSchemaVersion,
    record_type: "universal_plugin_broker_install_receipt",
    plugin: manifest.name,
    pluginDir,
    wrapperPath,
    contextSkillReceipt,
    vendorInjection,
    activation_notice:
      "Plugin configured. Run /reload-mcp where supported or restart active agent sessions to activate newly injected MCP servers.",
    records_as: "plugin_compatibility_configuration",
    build_evidence: false,
  };
}
