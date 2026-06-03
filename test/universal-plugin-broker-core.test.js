import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createDefaultUniversalPluginBrokerCore,
  createUniversalPluginManifest,
  detectInstalledPluginHosts,
  installUniversalPlugin,
  renderPluginContextSkillMd,
  renderUniversalMcpServerTemplate,
  validateUniversalPluginBrokerCore,
  validateUniversalPluginManifest,
} from "../src/runtime/universal-plugin-broker-core.js";

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function createPluginFixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ma-plugin-fixture-"));
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });
  await fs.mkdir(path.join(root, "dist"), { recursive: true });
  await fs.mkdir(path.join(root, "prompts"), { recursive: true });
  await fs.writeFile(
    path.join(root, "dist", "index.js"),
    "console.log(JSON.stringify({ status: 'success', source: 'fixture' }));\n",
  );
  await fs.writeFile(path.join(root, "prompts", "vet-rules.md"), "# Vet Rules\n\nUse MA gates.\n");
  await writeJson(
    path.join(root, "ma-manifest.json"),
    createUniversalPluginManifest({
      name: "ma-web3-scanner",
      version: "1.4.0",
      description: "AST vulnerability auditing for Solidity files.",
      entrypoint: "dist/index.js",
      mcp: {
        command: "node",
        args: ["{{PLUGIN_DIR}}/dist/index.js"],
      },
      ma_roles: {
        bind: ["$vet", "$sage", "$build"],
        prompt_injection_file: "prompts/vet-rules.md",
      },
    }),
  );
  return root;
}

test("Universal Plugin Broker core defines hybrid MCP and context-layer boundaries", () => {
  const core = validateUniversalPluginBrokerCore(createDefaultUniversalPluginBrokerCore());

  assert.equal(core.architecture.tooling_layer.protocol, "MCP stdio JSON-RPC");
  assert.equal(core.architecture.context_layer.canonical_skill_dir, ".agents/skills");
  assert.equal(core.mcp_injector_hosts.includes("claude-code"), true);
  assert.equal(core.mcp_injector_hosts.includes("antigravity"), true);
  assert.equal(core.mcp_injector_hosts.includes("cursor"), true);
  assert.equal(core.mcp_injector_hosts.includes("codex"), true);
  assert.equal(core.supported_agents.includes("claude-code"), true);
  assert.equal(core.supported_agents.includes("codex"), true);
  assert.equal(core.mutation_policy.may_mutate_release_state, false);
  assert.equal(core.mutation_policy.never_records_as, "build_evidence");
});

test("Universal Plugin Broker validates manifest and renders MCP plus MA skill context", () => {
  const manifest = validateUniversalPluginManifest(
    createUniversalPluginManifest({
      name: "MA Web3 Scanner",
      version: "1.4.0",
      description: "AST vulnerability auditing for Solidity files.",
      entrypoint: "dist/index.js",
      ma_roles: { bind: ["$vet", "$sage"] },
    }),
  );
  const template = renderUniversalMcpServerTemplate();
  const skill = renderPluginContextSkillMd(manifest);

  assert.equal(manifest.name, "ma-web3-scanner");
  assert.equal(manifest.ma_roles.bind.includes("$vet"), true);
  assert.match(template, /StdioServerTransport/);
  assert.match(template, /ListToolsRequestSchema/);
  assert.match(skill, /MCP server name: `ma-plugin-web3-scanner`/);
  assert.match(skill, /Do not mutate `\.ma\/release\.json`/);
  assert.throws(
    () =>
      validateUniversalPluginManifest({
        name: "bad",
        version: "1.0.0",
        entrypoint: "dist/index.js",
        mcp: { command: "node", args: [] },
        ma_roles: { bind: ["vet"] },
      }),
    /role bindings/,
  );
});

test("Universal Plugin Broker installs local plugin, injects vendor MCP configs, and exports MA context skill", async (t) => {
  const sourceDir = await createPluginFixture(t);
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "ma-plugin-home-"));
  t.after(async () => {
    await fs.rm(home, { recursive: true, force: true });
  });

  await writeJson(path.join(home, ".claude.json"), { existing: true });
  await fs.mkdir(path.join(home, ".antigravity"), { recursive: true });
  await fs.writeFile(path.join(home, ".antigravity", "config.toml"), "# existing agy config\n");
  await fs.mkdir(path.join(home, ".config", "Cursor", "User", "globalStorage"), {
    recursive: true,
  });
  await writeJson(path.join(home, ".config", "Cursor", "User", "globalStorage", "storage.json"), {
    existing: true,
  });
  await fs.mkdir(path.join(home, ".codex"), { recursive: true });
  await fs.writeFile(path.join(home, ".codex", "config.toml"), "# existing codex config\n");

  assert.deepEqual((await detectInstalledPluginHosts({ home })).sort(), [
    "antigravity",
    "claude-code",
    "codex",
    "cursor",
  ]);

  const receipt = await installUniversalPlugin({
    sourceDir,
    home,
    targets: ["claude-code", "antigravity", "cursor", "codex"],
  });
  const repeated = await installUniversalPlugin({
    sourceDir,
    home,
    targets: ["claude-code", "antigravity", "cursor", "codex"],
  });
  const claudeConfig = JSON.parse(await fs.readFile(path.join(home, ".claude.json"), "utf8"));
  const cursorStorage = JSON.parse(
    await fs.readFile(
      path.join(home, ".config", "Cursor", "User", "globalStorage", "storage.json"),
      "utf8",
    ),
  );
  const antigravityToml = await fs.readFile(path.join(home, ".antigravity", "config.toml"), "utf8");
  const codexToml = await fs.readFile(path.join(home, ".codex", "config.toml"), "utf8");
  const wrapperStat = await fs.stat(receipt.wrapperPath);
  const skillMd = await fs.readFile(
    path.join(home, ".agents", "skills", "ma-plugin-web3-scanner", "SKILL.md"),
    "utf8",
  );

  assert.equal(receipt.record_type, "universal_plugin_broker_install_receipt");
  assert.equal(receipt.records_as, "plugin_compatibility_configuration");
  assert.equal(receipt.build_evidence, false);
  assert.equal(receipt.vendorInjection.configured_hosts.length, 4);
  assert.equal(repeated.vendorInjection.configured_hosts.length, 4);
  assert.equal(Boolean(wrapperStat.mode & 0o111), true);
  assert.match(await fs.readFile(receipt.wrapperPath, "utf8"), /exec node/);
  assert.equal(claudeConfig.mcpServers["ma-plugin-web3-scanner"].command, receipt.wrapperPath);
  assert.equal(
    cursorStorage["mcp.mcpServers"]["ma-plugin-web3-scanner"].command,
    receipt.wrapperPath,
  );
  assert.equal((antigravityToml.match(/name = "ma-plugin-web3-scanner"/g) ?? []).length, 1);
  assert.equal((codexToml.match(/\[mcp_servers\."ma-plugin-web3-scanner"\]/g) ?? []).length, 1);
  assert.match(skillMd, /\$vet/);
  assert.match(skillMd, /\$build/);
  assert.match(skillMd, /never as `build_evidence`/);
});

test("Universal Plugin Broker skips absent vendors instead of creating unrelated host config", async (t) => {
  const sourceDir = await createPluginFixture(t);
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "ma-plugin-empty-home-"));
  t.after(async () => {
    await fs.rm(home, { recursive: true, force: true });
  });

  const receipt = await installUniversalPlugin({
    sourceDir,
    home,
    targets: ["claude-code", "antigravity", "cursor", "codex"],
  });

  assert.equal(receipt.vendorInjection.configured_hosts.length, 0);
  assert.equal(
    receipt.vendorInjection.receipts.every((entry) => entry.status === "skipped"),
    true,
  );
  assert.equal(
    await fs.readdir(path.join(home, ".agents", "skills")).then((items) => items.length),
    1,
  );
});
