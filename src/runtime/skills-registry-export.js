import { createHash } from "node:crypto";
import { existsSync as pathExistsSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getAgentInvocation } from "../agents.js";
import { ensureDir, readJson, writeFileIfMissing } from "../fs-utils.js";
import { getRepoRoot, getRuntimeSubsystemPath } from "../paths.js";

export const skillsRegistryExportSchemaVersion = "0.1.0";
export const canonicalSkillsDir = ".agents/skills";

const home = os.homedir();
const configHome = process.env.XDG_CONFIG_HOME || path.join(home, ".config");
const codexHome = process.env.CODEX_HOME?.trim() || path.join(home, ".codex");
const claudeHome = process.env.CLAUDE_CONFIG_DIR?.trim() || path.join(home, ".claude");

function getOpenClawGlobalSkillsDir() {
  if (pathExistsSync(path.join(home, ".openclaw"))) return path.join(home, ".openclaw/skills");
  if (pathExistsSync(path.join(home, ".clawdbot"))) return path.join(home, ".clawdbot/skills");
  if (pathExistsSync(path.join(home, ".moltbot"))) return path.join(home, ".moltbot/skills");
  return path.join(home, ".openclaw/skills");
}

const universalTargets = [
  "codex",
  "opencode",
  "cursor",
  "amp",
  "cline",
  "gemini-cli",
  "github-copilot",
  "antigravity",
  "deepagents",
  "dexto",
  "firebender",
  "kimi-cli",
  "warp",
  "replit",
  "universal",
];

const nonUniversalTargets = [
  "claude-code",
  "windsurf",
  "goose",
  "augment",
  "aider-desk",
  "continue",
  "roo",
  "kiro-cli",
  "junie",
  "devin",
  "openhands",
  "cortex",
  "crush",
  "forgecode",
  "bob",
  "codebuddy",
  "codemaker",
  "codestudio",
  "command-code",
  "codearts-agent",
  "droid",
  "hermes-agent",
  "iflow-cli",
  "kilo",
  "kode",
  "mcpjam",
  "mistral-vibe",
  "mux",
  "neovate",
  "openclaw",
  "pi",
  "pochi",
  "adal",
  "qoder",
  "qwen-code",
  "rovodev",
  "tabnine-cli",
  "trae",
  "trae-cn",
  "zencoder",
];

const nonUniversalDirs = {
  "claude-code": ".claude/skills",
  windsurf: ".windsurf/skills",
  goose: ".goose/skills",
  augment: ".augment/skills",
  "aider-desk": ".aider-desk/skills",
  continue: ".continue/skills",
  roo: ".roo/skills",
  "kiro-cli": ".kiro/skills",
  junie: ".junie/skills",
  devin: ".devin/skills",
  openhands: ".openhands/skills",
  cortex: ".cortex/skills",
  crush: ".crush/skills",
  forgecode: ".forge/skills",
  bob: ".bob/skills",
  codebuddy: ".codebuddy/skills",
  codemaker: ".codemaker/skills",
  codestudio: ".codestudio/skills",
  "command-code": ".commandcode/skills",
  "codearts-agent": ".codeartsdoer/skills",
  droid: ".factory/skills",
  "hermes-agent": ".hermes/skills",
  "iflow-cli": ".iflow/skills",
  kilo: ".kilocode/skills",
  kode: ".kode/skills",
  mcpjam: ".mcpjam/skills",
  "mistral-vibe": ".vibe/skills",
  mux: ".mux/skills",
  neovate: ".neovate/skills",
  openclaw: "skills",
  pi: ".pi/skills",
  pochi: ".pochi/skills",
  adal: ".adal/skills",
  qoder: ".qoder/skills",
  "qwen-code": ".qwen/skills",
  rovodev: ".rovodev/skills",
  "tabnine-cli": ".tabnine/agent/skills",
  trae: ".trae/skills",
  "trae-cn": ".trae/skills",
  zencoder: ".zencoder/skills",
};

const globalDirOverrides = {
  codex: path.join(codexHome, "skills"),
  opencode: path.join(configHome, "opencode", "skills"),
  cursor: path.join(home, ".agents", "skills"),
  amp: path.join(configHome, "agents", "skills"),
  "claude-code": path.join(claudeHome, "skills"),
  "gemini-cli": path.join(home, ".gemini", "skills"),
  "github-copilot": path.join(home, ".copilot", "skills"),
  antigravity: path.join(home, ".gemini", "antigravity", "skills"),
  openclaw: getOpenClawGlobalSkillsDir(),
  pi: path.join(home, ".pi", "agent", "skills"),
  windsurf: path.join(home, ".codeium", "windsurf", "skills"),
  goose: path.join(configHome, "goose", "skills"),
};

const universalNativeContract = {
  artifact: "skill",
  path: `${canonicalSkillsDir}/{name}/SKILL.md`,
  format: "markdown",
  activation: "host-loads-canonical-agent-skills",
};

function surfaceForAgent(name) {
  if (
    [
      "cursor",
      "antigravity",
      "windsurf",
      "continue",
      "roo",
      "kiro-cli",
      "junie",
      "tabnine-cli",
      "github-copilot",
    ].includes(name)
  )
    return "ide";
  if (["devin", "openhands", "replit"].includes(name)) return "cloud";
  return "cli";
}

function vendorForAgent(name) {
  if (["codex", "deepagents"].includes(name)) return "openai";
  if (["claude-code"].includes(name)) return "anthropic";
  if (["gemini-cli", "antigravity", "dexto", "firebender", "kimi-cli"].includes(name))
    return "google";
  if (["github-copilot"].includes(name)) return "github";
  if (["cursor", "windsurf", "continue", "roo", "kiro-cli", "junie", "tabnine-cli"].includes(name))
    return "ide";
  if (["openclaw", "pi", "hermes-agent"].includes(name))
    return name === "pi" ? "pi" : name === "openclaw" ? "openclaw" : "nous-research";
  return "community";
}

export const agentRegistry = Object.fromEntries([
  ...universalTargets.map((name) => [
    name,
    {
      name,
      displayName: name,
      skillsDir: canonicalSkillsDir,
      globalSkillsDir: globalDirOverrides[name] ?? path.join(home, ".agents", "skills"),
      universal: true,
      vendor: vendorForAgent(name),
      product: name,
      surface: surfaceForAgent(name),
      support: "native",
      native_artifacts: [universalNativeContract],
      verification: "distribution-contract",
    },
  ]),
  ...nonUniversalTargets.map((name) => [
    name,
    {
      name,
      displayName: name,
      skillsDir: nonUniversalDirs[name],
      globalSkillsDir: globalDirOverrides[name] ?? path.join(home, nonUniversalDirs[name]),
      universal: false,
      vendor: vendorForAgent(name),
      product: name,
      surface: surfaceForAgent(name),
      support: "native",
      native_artifacts: [
        {
          artifact: "skill",
          path: `${nonUniversalDirs[name]}/{name}/SKILL.md`,
          format: "markdown",
          activation: "host-loads-project-skill-directory",
        },
      ],
      verification: "distribution-contract",
    },
  ]),
]);

export function getSkillsRegistryExportPath() {
  return getRuntimeSubsystemPath("context", "skills-registry-export.json");
}

export function createDefaultSkillsRegistryExport() {
  return {
    schemaVersion: skillsRegistryExportSchemaVersion,
    product: "Meta-Architect",
    purpose:
      "Defines MA-owned exported skill compatibility payloads across universal and non-universal host agents.",
    canonical_dir: canonicalSkillsDir,
    universal_targets: universalTargets,
    non_universal_targets: nonUniversalTargets,
    target_count: Object.keys(agentRegistry).length,
    targets: agentRegistry,
    authority_boundary: {
      exported_payloads_may_mutate_release_state: false,
      exported_payloads_are_managed_workers: false,
      canonical_ma_authority: "$maestro_or_owning_lane",
    },
  };
}

export function validateSkillsRegistryExport(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("skills registry export must be an object");
  }
  if (value.schemaVersion !== skillsRegistryExportSchemaVersion) {
    throw new Error(`Unsupported skills registry export schemaVersion: ${value.schemaVersion}`);
  }
  if (value.canonical_dir !== canonicalSkillsDir) {
    throw new Error("skills registry export must use .agents/skills as canonical_dir");
  }
  if (value.authority_boundary?.exported_payloads_may_mutate_release_state !== false) {
    throw new Error("exported skill payloads must not mutate release state");
  }
  return value;
}

export async function seedSkillsRegistryExportArtifacts() {
  await ensureDir(getRuntimeSubsystemPath("context"));
  await writeFileIfMissing(
    getSkillsRegistryExportPath(),
    `${JSON.stringify(createDefaultSkillsRegistryExport(), null, 2)}\n`,
  );
}

export async function loadSkillsRegistryExport() {
  return validateSkillsRegistryExport(await readJson(getSkillsRegistryExportPath()));
}

export function isUniversalAgent(agentType) {
  return agentRegistry[agentType]?.universal === true;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function copyCompatibilityFiles({ targetDir, skillMd, receipt, lockEntry }) {
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(path.join(targetDir, "SKILL.md"), skillMd);
  await fs.writeFile(
    path.join(targetDir, "ma-install-receipt.json"),
    `${JSON.stringify(receipt, null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(targetDir, "ma-skill-lock.json"),
    `${JSON.stringify(lockEntry, null, 2)}\n`,
  );
}

export async function detectProjectAgentRoot(agentType, cwd = getRepoRoot()) {
  const agent = agentRegistry[agentType];
  if (!agent || agent.universal) {
    return true;
  }

  const [rootDir] = agent.skillsDir.split("/");
  return pathExists(path.join(cwd, rootDir));
}

export function sanitizeSkillName(name) {
  return `${name}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/\.+/g, ".")
    .replace(/^\.+/, "")
    .replace(/^-+|-+$/g, "");
}

export function resolveSkillInstallPlan({
  skillName,
  agentType,
  cwd = getRepoRoot(),
  global = false,
  mode = "symlink",
  agentRootExists = false,
}) {
  const agent = agentRegistry[agentType];
  if (!agent) {
    throw new Error(`Unsupported agent type: ${agentType}`);
  }

  const safeSkillName = sanitizeSkillName(skillName);
  if (!safeSkillName) {
    throw new Error("Skill name is required");
  }

  const canonicalBase = global
    ? path.join(home, ".agents", "skills")
    : path.join(cwd, canonicalSkillsDir);
  const canonicalDir = path.join(canonicalBase, safeSkillName);
  const agentBase = global
    ? agent.globalSkillsDir
    : agent.universal
      ? canonicalBase
      : path.join(cwd, agent.skillsDir);
  const targetDir = path.join(agentBase, safeSkillName);

  if (mode === "copy") {
    return {
      action: "copy",
      canonicalDir,
      targetDir,
      skipped: false,
      reason: "copy mode writes directly to target agent directory",
    };
  }

  if (global && agent.universal) {
    return {
      action: "canonical-only",
      canonicalDir,
      targetDir: canonicalDir,
      skipped: false,
      reason: "global universal agent reads canonical directory directly",
    };
  }

  if (!global && !agent.universal && !agentRootExists) {
    return {
      action: "skip-missing-agent-root",
      canonicalDir,
      targetDir,
      skipped: true,
      reason: "non-universal project agent root is absent",
    };
  }

  return {
    action: agent.universal ? "canonical-only" : "symlink",
    canonicalDir,
    targetDir: agent.universal ? canonicalDir : targetDir,
    skipped: false,
    reason: agent.universal
      ? "universal agent reads canonical directory directly"
      : "non-universal agent receives symlink from canonical payload",
  };
}

export function createSkillCompatibilityPayload({
  name,
  description,
  trigger = null,
  capabilities = [],
}) {
  const safeName = sanitizeSkillName(name);
  if (!safeName) {
    throw new Error("Skill payload name is required");
  }

  const normalizedCapabilities = capabilities
    .filter((capability) => typeof capability === "string" && capability.trim())
    .map((capability) => capability.trim());

  return {
    schemaVersion: skillsRegistryExportSchemaVersion,
    record_type: "skill_compatibility_payload",
    product: "Meta-Architect",
    name: safeName,
    description:
      description ||
      "Meta-Architect compatibility payload that routes host agents into MA-owned runtime contracts.",
    trigger: trigger || `$${safeName}`,
    capabilities: normalizedCapabilities,
    canonical_dir: canonicalSkillsDir,
    authority_boundary: {
      may_mutate_release_state: false,
      is_managed_worker: false,
      canonical_authority: "$maestro_or_owning_lane",
    },
  };
}

export function renderSkillCompatibilitySkillMd(payload, { agentType = "codex" } = {}) {
  if (payload?.record_type !== "skill_compatibility_payload") {
    throw new Error("Expected skill compatibility payload");
  }

  return [
    "---",
    `name: ${payload.name}`,
    `description: ${payload.description}`,
    "---",
    "",
    `# ${payload.name}`,
    "",
    "This exported host payload is a compatibility entrypoint for Meta-Architect.",
    "",
    "## Invocation",
    "",
    `- Start the umbrella lane with \`${getAgentInvocation(agentType, agentType === "codex" ? "maestro" : payload.name)}\` in this host.`,
    "- Dispatch to the canonical MA runtime as `ma run '$maestro'`.",
    "- Lane aliases: `arch`, `sage`, `flow`, `vet`, `vibe`, and `build`.",
    "",
    "## Authority",
    "",
    "- Route execution through `$maestro` or the owning MA lane.",
    "- Do not mutate `.ma/release.json` or `.ma/decisions.json` directly.",
    "- Treat Obsidian/vault context as `vault_context`, not `build_evidence`.",
    "- Preserve Context Economy safety valves for warnings, failed checks, and known gaps.",
    "",
    "## Capabilities",
    "",
    ...(payload.capabilities.length === 0
      ? ["- shared_ma_runtime_contracts"]
      : payload.capabilities.map((capability) => `- ${capability}`)),
    "",
  ].join("\n");
}

export function createHostInstallReceipt({ payload, installPlan }) {
  if (payload?.record_type !== "skill_compatibility_payload") {
    throw new Error("Host install receipt requires a compatibility payload");
  }
  if (!installPlan || typeof installPlan !== "object") {
    throw new Error("Host install receipt requires an install plan");
  }

  return {
    schemaVersion: skillsRegistryExportSchemaVersion,
    record_type: "host_install_receipt",
    skill: payload.name,
    action: installPlan.action,
    canonicalDir: installPlan.canonicalDir,
    targetDir: installPlan.targetDir,
    skipped: installPlan.skipped === true,
    authority_boundary: payload.authority_boundary,
    records_as: "host_compatibility_payload",
    production_evidence: false,
  };
}

export function createSkillLockEntry({
  payload,
  agentType = "codex",
  source = "meta-architect",
  sourceType = "local",
  sourceUrl = "skills/",
  ref = null,
  skillPath = null,
  skillFolderHash = null,
  selectedAgentTargets = [],
  installedAt = new Date().toISOString(),
  updatedAt = installedAt,
} = {}) {
  if (payload?.record_type !== "skill_compatibility_payload") {
    throw new Error("Skill lock entry requires a compatibility payload");
  }

  const renderedPayload = renderSkillCompatibilitySkillMd(payload, { agentType });
  const folderHash =
    skillFolderHash ??
    createHash("sha256")
      .update(renderedPayload)
      .update(JSON.stringify(payload.authority_boundary))
      .digest("hex");

  return {
    schemaVersion: skillsRegistryExportSchemaVersion,
    record_type: "skill_lock_entry",
    skill: payload.name,
    source,
    sourceType,
    sourceUrl,
    ref,
    skillPath,
    skillFolderHash: folderHash,
    installedAt,
    updatedAt,
    selectedAgentTargets: selectedAgentTargets.map((target) => `${target}`),
    authority_boundary: payload.authority_boundary,
  };
}

export function validateSkillLockEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error("Skill lock entry must be an object");
  }
  if (entry.record_type !== "skill_lock_entry") {
    throw new Error("Skill lock entry must use record_type skill_lock_entry");
  }
  for (const field of [
    "skill",
    "source",
    "sourceType",
    "sourceUrl",
    "skillFolderHash",
    "installedAt",
    "updatedAt",
  ]) {
    if (typeof entry[field] !== "string" || entry[field].trim() === "") {
      throw new Error(`Skill lock entry requires ${field}`);
    }
  }
  if (!Array.isArray(entry.selectedAgentTargets)) {
    throw new Error("Skill lock entry requires selectedAgentTargets");
  }
  if (entry.authority_boundary?.may_mutate_release_state !== false) {
    throw new Error("Skill lock entries must preserve MA authority boundaries");
  }
  return entry;
}

export async function writeSkillCompatibilityExport({
  payload,
  agentType,
  cwd = getRepoRoot(),
  global = false,
  mode = "symlink",
  agentRootExists = null,
  createSymlink = fs.symlink,
  lockMetadata = {},
}) {
  const effectiveAgentRootExists =
    agentRootExists ?? (await detectProjectAgentRoot(agentType, cwd));
  const installPlan = resolveSkillInstallPlan({
    skillName: payload.name,
    agentType,
    cwd,
    global,
    mode,
    agentRootExists: effectiveAgentRootExists,
  });
  const skillMd = renderSkillCompatibilitySkillMd(payload, { agentType });
  const lockEntry = validateSkillLockEntry(
    createSkillLockEntry({
      payload,
      agentType,
      selectedAgentTargets: [agentType],
      ...lockMetadata,
    }),
  );

  await fs.mkdir(installPlan.canonicalDir, { recursive: true });
  await fs.writeFile(path.join(installPlan.canonicalDir, "SKILL.md"), skillMd);
  const receipt = createHostInstallReceipt({ payload, installPlan });
  await fs.writeFile(
    path.join(installPlan.canonicalDir, "ma-install-receipt.json"),
    `${JSON.stringify(receipt, null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(installPlan.canonicalDir, "ma-skill-lock.json"),
    `${JSON.stringify(lockEntry, null, 2)}\n`,
  );
  let fanoutMode = installPlan.action;

  if (installPlan.action === "copy") {
    await copyCompatibilityFiles({
      targetDir: installPlan.targetDir,
      skillMd,
      receipt,
      lockEntry,
    });
  }

  if (installPlan.action === "symlink") {
    await fs.mkdir(path.dirname(installPlan.targetDir), { recursive: true });
    await fs.rm(installPlan.targetDir, { recursive: true, force: true });
    try {
      await createSymlink(installPlan.canonicalDir, installPlan.targetDir, "dir");
    } catch {
      fanoutMode = "copy-fallback";
      await copyCompatibilityFiles({
        targetDir: installPlan.targetDir,
        skillMd,
        receipt,
        lockEntry,
      });
    }
  }

  return {
    installPlan,
    receipt,
    lockEntry,
    fanoutMode,
    written: [
      path.join(installPlan.canonicalDir, "SKILL.md"),
      path.join(installPlan.canonicalDir, "ma-install-receipt.json"),
      path.join(installPlan.canonicalDir, "ma-skill-lock.json"),
    ],
  };
}

export async function inspectSkillCompatibilityInstall({ result, payload }) {
  if (!result || typeof result !== "object") {
    throw new Error("Skill install inspection requires an install result");
  }
  if (payload?.record_type !== "skill_compatibility_payload") {
    throw new Error("Skill install inspection requires a compatibility payload");
  }

  const { installPlan, fanoutMode } = result;
  const errors = [];
  const canonicalFiles = [
    path.join(installPlan.canonicalDir, "SKILL.md"),
    path.join(installPlan.canonicalDir, "ma-install-receipt.json"),
    path.join(installPlan.canonicalDir, "ma-skill-lock.json"),
  ];

  for (const file of canonicalFiles) {
    if (!(await pathExists(file))) {
      errors.push(`missing canonical file: ${file}`);
    }
  }

  let targetKind = "canonical";
  if (installPlan.skipped) {
    targetKind = "skipped";
  } else if (installPlan.targetDir !== installPlan.canonicalDir) {
    try {
      const targetStat = await fs.lstat(installPlan.targetDir);
      if (targetStat.isSymbolicLink()) {
        targetKind = "symlink";
      } else if (targetStat.isDirectory()) {
        targetKind = "directory-copy";
      } else {
        errors.push(`target is not a directory or symlink: ${installPlan.targetDir}`);
      }
    } catch {
      errors.push(`missing target path: ${installPlan.targetDir}`);
    }

    for (const file of ["SKILL.md", "ma-install-receipt.json", "ma-skill-lock.json"]) {
      const targetFile = path.join(installPlan.targetDir, file);
      if (!(await pathExists(targetFile))) {
        errors.push(`missing target file: ${targetFile}`);
      }
    }
  }

  if (fanoutMode === "copy-fallback" && targetKind !== "directory-copy") {
    errors.push("copy-fallback fanout must leave a target directory copy");
  }
  if (installPlan.action === "symlink" && fanoutMode === "symlink" && targetKind !== "symlink") {
    errors.push("symlink fanout must leave a target symlink");
  }

  return {
    schemaVersion: skillsRegistryExportSchemaVersion,
    record_type: "skill_install_verification",
    skill: payload.name,
    action: installPlan.action,
    fanoutMode,
    targetKind,
    canonicalDir: installPlan.canonicalDir,
    targetDir: installPlan.targetDir,
    ok: errors.length === 0,
    errors,
    authority_boundary: payload.authority_boundary,
    production_evidence: false,
  };
}

export async function verifyCrossAgentInstallMatrix({
  payload,
  cwd = getRepoRoot(),
  targets = ["codex", "claude-code", "aider-desk"],
  existingAgentRoots = [],
  copyFallbackTargets = [],
} = {}) {
  if (payload?.record_type !== "skill_compatibility_payload") {
    throw new Error("Cross-agent install verification requires a compatibility payload");
  }

  for (const agentType of existingAgentRoots) {
    const agent = agentRegistry[agentType];
    if (agent && !agent.universal) {
      const [rootDir] = agent.skillsDir.split("/");
      await fs.mkdir(path.join(cwd, rootDir), { recursive: true });
    }
  }

  const results = [];
  for (const agentType of targets) {
    const forceFallback = copyFallbackTargets.includes(agentType);
    const result = await writeSkillCompatibilityExport({
      payload,
      agentType,
      cwd,
      agentRootExists: await detectProjectAgentRoot(agentType, cwd),
      createSymlink: forceFallback
        ? async () => {
            throw new Error("forced symlink failure for verification");
          }
        : fs.symlink,
    });
    const verification = await inspectSkillCompatibilityInstall({ result, payload });
    results.push(verification);
  }

  return {
    schemaVersion: skillsRegistryExportSchemaVersion,
    record_type: "cross_agent_install_verification",
    skill: payload.name,
    target_count: results.length,
    ok: results.every((result) => result.ok),
    results,
    authority_boundary: payload.authority_boundary,
    production_evidence: false,
  };
}
