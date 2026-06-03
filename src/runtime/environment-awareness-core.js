import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ensureDir, readJson, writeFileIfMissing, writeJson } from "../fs-utils.js";
import { getRepoRoot, getRuntimeSubsystemPath, packageRoot } from "../paths.js";

export const environmentAwarenessSchemaVersion = "0.1.0";
export const environmentCapabilityRecordType = "environment_capability";

const repoSkillSurfaces = [
  { relativePath: "skills", owner: "ma_owned", scope: "repo_local", capabilityType: "skill" },
  {
    relativePath: ".agents/skills",
    owner: "host_native",
    scope: "repo_local",
    capabilityType: "skill",
  },
  {
    relativePath: ".codex/skills",
    owner: "host_native",
    scope: "repo_local",
    capabilityType: "skill",
  },
  {
    relativePath: ".claude/skills",
    owner: "host_native",
    scope: "repo_local",
    capabilityType: "skill",
  },
  {
    relativePath: ".cursor/rules",
    owner: "host_native",
    scope: "repo_local",
    capabilityType: "rule",
  },
  {
    relativePath: ".windsurf",
    owner: "host_native",
    scope: "repo_local",
    capabilityType: "rule",
  },
  {
    relativePath: "plugins/meta-architect/skills",
    owner: "ma_owned",
    scope: "repo_local",
    capabilityType: "skill",
  },
];

const repoMcpSurfaces = [
  { relativePath: "mcp/servers.json", owner: "repo_local", scope: "repo_local" },
  { relativePath: "mcp/local-capabilities.json", owner: "ma_owned", scope: "repo_local" },
  { relativePath: ".mcp.json", owner: "repo_local", scope: "repo_local" },
  { relativePath: "plugins/meta-architect/.mcp.json", owner: "ma_owned", scope: "repo_local" },
];

const repoPluginSurfaces = [
  { relativePath: "plugins", owner: "repo_local", scope: "repo_local" },
  { relativePath: ".agents/plugins/marketplace.json", owner: "repo_local", scope: "repo_local" },
  {
    relativePath: "plugins/meta-architect/.codex-plugin/plugin.json",
    owner: "ma_owned",
    scope: "repo_local",
  },
  { relativePath: "plugins/meta-architect/.app.json", owner: "ma_owned", scope: "repo_local" },
  {
    relativePath: "plugins/meta-architect/obsidian/manifest.json",
    owner: "ma_owned",
    scope: "repo_local",
  },
];

const globalSkillSurfaces = [
  [".codex/skills", "host_native"],
  [".agents/skills", "host_native"],
  [".claude/skills", "host_native"],
  [".cursor/skills", "host_native"],
  [".config/opencode/skills", "host_native"],
];

function normalizeName(value) {
  return `${value ?? ""}`.trim();
}

function uniqueCapabilities(capabilities) {
  const seen = new Set();
  return capabilities.filter((capability) => {
    const key = [
      capability.capability_type,
      capability.source_scope,
      capability.source_path,
      capability.name,
    ].join("\0");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function redactGlobalPath(targetPath, home = os.homedir()) {
  const normalizedHome = path.resolve(home);
  const normalizedTarget = path.resolve(targetPath);
  if (normalizedTarget === normalizedHome) return "~";
  if (normalizedTarget.startsWith(`${normalizedHome}${path.sep}`)) {
    return `~/${path.relative(normalizedHome, normalizedTarget).split(path.sep).join("/")}`;
  }
  return normalizedTarget;
}

function packageCapabilitySourcePath(repoRoot) {
  const normalizedPackageRoot = path.resolve(packageRoot);
  return normalizedPackageRoot === repoRoot ? "." : "package://@jstn-sdk/ma";
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonIfExists(targetPath) {
  try {
    return JSON.parse(await fs.readFile(targetPath, "utf8"));
  } catch {
    return null;
  }
}

async function discoverSkillSurface({ rootPath, sourcePath, sourceScope, owner, capabilityType }) {
  if (!(await pathExists(rootPath))) return [];
  const entries = await fs.readdir(rootPath, { withFileTypes: true }).catch(() => []);
  const capabilities = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillDir = path.join(rootPath, entry.name);
    const skillMdPath = path.join(skillDir, "SKILL.md");
    const hasSkillMd = await pathExists(skillMdPath);
    const ruleFiles =
      capabilityType === "rule"
        ? (await fs.readdir(skillDir).catch(() => [])).filter((file) => file.endsWith(".md"))
        : [];
    if (!hasSkillMd && ruleFiles.length === 0) continue;
    capabilities.push(
      createEnvironmentCapability({
        name: entry.name,
        capabilityType,
        owner,
        sourceScope,
        sourcePath: `${sourcePath}/${entry.name}`,
        entrypoint: hasSkillMd ? "SKILL.md" : ruleFiles[0],
        confidence: hasSkillMd ? "high" : "medium",
      }),
    );
  }
  return capabilities;
}

async function discoverMcpSurface({ targetPath, sourcePath, owner, sourceScope }) {
  const document = await readJsonIfExists(targetPath);
  if (!document) return [];
  const records = [];
  const servers = document.mcpServers ?? document.servers ?? {};
  if (Array.isArray(servers)) {
    for (const server of servers) {
      records.push(
        createEnvironmentCapability({
          name: normalizeName(server.name ?? server.category ?? server.capability),
          capabilityType: "mcp_server",
          owner,
          sourceScope,
          sourcePath,
          entrypoint: normalizeName(server.endpoint ?? server.url ?? server.module),
          confidence: "medium",
        }),
      );
    }
  } else if (servers && typeof servers === "object") {
    for (const [name, server] of Object.entries(servers)) {
      records.push(
        createEnvironmentCapability({
          name,
          capabilityType: "mcp_server",
          owner,
          sourceScope,
          sourcePath,
          entrypoint: normalizeName(server?.endpoint ?? server?.url ?? server?.command),
          confidence: "medium",
        }),
      );
    }
  }
  const capabilities = Array.isArray(document.capabilities) ? document.capabilities : [];
  for (const capability of capabilities) {
    records.push(
      createEnvironmentCapability({
        name: normalizeName(capability.capability ?? capability.name),
        capabilityType: "local_capability",
        owner,
        sourceScope,
        sourcePath,
        entrypoint: normalizeName(capability.module ?? capability.readinessCheck),
        confidence: "high",
      }),
    );
  }
  return records.filter((record) => record.name);
}

async function discoverPluginSurface({ targetPath, sourcePath, owner, sourceScope }) {
  if (!(await pathExists(targetPath))) return [];
  const records = [];
  const stat = await fs.stat(targetPath).catch(() => null);
  if (!stat) return records;
  if (stat.isDirectory()) {
    const entries = await fs.readdir(targetPath, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      records.push(
        createEnvironmentCapability({
          name: entry.name,
          capabilityType: "plugin",
          owner,
          sourceScope,
          sourcePath: `${sourcePath}/${entry.name}`,
          entrypoint: null,
          confidence: "medium",
        }),
      );
    }
    return records;
  }
  const document = await readJsonIfExists(targetPath);
  records.push(
    createEnvironmentCapability({
      name: normalizeName(document?.name ?? document?.id ?? path.basename(sourcePath)),
      capabilityType: "plugin",
      owner,
      sourceScope,
      sourcePath,
      entrypoint: path.basename(sourcePath),
      confidence: document ? "high" : "low",
    }),
  );
  return records.filter((record) => record.name);
}

export function getEnvironmentAwarenessCorePath() {
  return getRuntimeSubsystemPath("context", "environment-awareness-core.json");
}

export function createEnvironmentCapability({
  name,
  capabilityType,
  owner,
  sourceScope,
  sourcePath,
  entrypoint = null,
  confidence = "medium",
}) {
  if (!name || !capabilityType || !owner || !sourceScope || !sourcePath) {
    throw new Error("environment capability requires name, capabilityType, owner, scope, and path");
  }
  return {
    record_type: environmentCapabilityRecordType,
    name,
    capability_type: capabilityType,
    owner,
    source_scope: sourceScope,
    source_path: sourcePath,
    entrypoint,
    confidence,
    records_as: "available_capability",
    never_records_as: "build_evidence",
    may_use_when: ["task_relevant", "lane_approved", "safe_read_only"],
    use_requires: ["$maestro_or_owning_lane_selection", "redaction_gateway_for_provider_bound_use"],
    mutation_allowed: false,
    authority: "$maestro_or_owning_lane",
  };
}

export function createDefaultEnvironmentAwarenessCore({ capabilities = [] } = {}) {
  return {
    schemaVersion: environmentAwarenessSchemaVersion,
    product: "Meta-Architect",
    purpose:
      "Discovers existing workspace, host, MCP, and plugin capabilities so MA can use relevant tools intentionally without taking ownership or treating them as build evidence.",
    discovery_policy: {
      default_scopes: ["repo_local", "package_local"],
      global_scopes_require_opt_in: true,
      auto_run_discovered_tools: false,
      mutate_discovered_configs: false,
      expose_private_global_paths: false,
      records_as: "available_capability",
      never_records_as: "build_evidence",
      authority_returns_to: "$maestro_or_owning_lane",
    },
    known_surface_types: ["skill", "rule", "mcp_server", "local_capability", "plugin"],
    capabilities: uniqueCapabilities(capabilities),
  };
}

export function validateEnvironmentAwarenessCore(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("environment awareness core must be an object");
  }
  if (value.schemaVersion !== environmentAwarenessSchemaVersion) {
    throw new Error(`Unsupported environment awareness schemaVersion: ${value.schemaVersion}`);
  }
  if (value.discovery_policy?.records_as !== "available_capability") {
    throw new Error("environment awareness must record as available_capability");
  }
  if (value.discovery_policy?.never_records_as !== "build_evidence") {
    throw new Error("environment awareness must never record as build_evidence");
  }
  if (value.discovery_policy?.auto_run_discovered_tools !== false) {
    throw new Error("environment awareness must not auto-run discovered tools");
  }
  if (!Array.isArray(value.capabilities)) {
    throw new Error("environment awareness core requires capabilities array");
  }
  for (const capability of value.capabilities) {
    if (
      capability?.record_type !== environmentCapabilityRecordType ||
      capability.records_as !== "available_capability" ||
      capability.never_records_as !== "build_evidence" ||
      capability.mutation_allowed !== false
    ) {
      throw new Error("environment capabilities must be read-only available_capability records");
    }
  }
  return value;
}

export async function discoverEnvironmentCapabilities({
  cwd = getRepoRoot(),
  home = os.homedir(),
  includeGlobal = false,
} = {}) {
  const repoRoot = path.resolve(cwd);
  const capabilities = [];
  for (const surface of repoSkillSurfaces) {
    capabilities.push(
      ...(await discoverSkillSurface({
        rootPath: path.join(repoRoot, surface.relativePath),
        sourcePath: surface.relativePath,
        sourceScope: surface.scope,
        owner: surface.owner,
        capabilityType: surface.capabilityType,
      })),
    );
  }
  for (const surface of repoMcpSurfaces) {
    capabilities.push(
      ...(await discoverMcpSurface({
        targetPath: path.join(repoRoot, surface.relativePath),
        sourcePath: surface.relativePath,
        sourceScope: surface.scope,
        owner: surface.owner,
      })),
    );
  }
  for (const surface of repoPluginSurfaces) {
    capabilities.push(
      ...(await discoverPluginSurface({
        targetPath: path.join(repoRoot, surface.relativePath),
        sourcePath: surface.relativePath,
        sourceScope: surface.scope,
        owner: surface.owner,
      })),
    );
  }

  if (includeGlobal) {
    for (const [relativePath, owner] of globalSkillSurfaces) {
      const rootPath = path.join(home, relativePath);
      capabilities.push(
        ...(await discoverSkillSurface({
          rootPath,
          sourcePath: redactGlobalPath(rootPath, home),
          sourceScope: "global_user_config",
          owner,
          capabilityType: "skill",
        })),
      );
    }
  }

  capabilities.push(
    createEnvironmentCapability({
      name: "package-root",
      capabilityType: "plugin",
      owner: "ma_owned",
      sourceScope: "package_local",
      sourcePath: packageCapabilitySourcePath(repoRoot),
      entrypoint: "package.json",
      confidence: "high",
    }),
  );

  return uniqueCapabilities(capabilities);
}

export async function createDiscoveredEnvironmentAwarenessCore(options = {}) {
  return validateEnvironmentAwarenessCore(
    createDefaultEnvironmentAwarenessCore({
      capabilities: await discoverEnvironmentCapabilities(options),
    }),
  );
}

export function selectEnvironmentCapabilitiesForTask(core, taskIntent = "") {
  const document = validateEnvironmentAwarenessCore(core);
  const intent = taskIntent.toLowerCase();
  const selected = document.capabilities.filter((capability) => {
    const haystack = [
      capability.name,
      capability.capability_type,
      capability.owner,
      capability.source_path,
      capability.entrypoint,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return intent
      .split(/[^a-z0-9_-]+/i)
      .filter((token) => token.length >= 3)
      .some((token) => haystack.includes(token));
  });
  return {
    record_type: "environment_capability_selection",
    task_intent: taskIntent,
    selected,
    selected_count: selected.length,
    records_as: "available_capability",
    never_records_as: "build_evidence",
    authority: "$maestro_or_owning_lane",
  };
}

export async function seedEnvironmentAwarenessCoreArtifacts(options = {}) {
  await ensureDir(getRuntimeSubsystemPath("context"));
  await writeFileIfMissing(
    getEnvironmentAwarenessCorePath(),
    `${JSON.stringify(await createDiscoveredEnvironmentAwarenessCore(options), null, 2)}\n`,
  );
}

export async function refreshEnvironmentAwarenessCore(options = {}) {
  const next = await createDiscoveredEnvironmentAwarenessCore(options);
  await writeJson(getEnvironmentAwarenessCorePath(), next);
  return next;
}

export async function loadEnvironmentAwarenessCore() {
  return validateEnvironmentAwarenessCore(await readJson(getEnvironmentAwarenessCorePath()));
}
