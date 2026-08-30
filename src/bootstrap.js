import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { detectInstalled, getAgent } from "./agents.js";
import { loadDecisionLog } from "./decision-log.js";
import { inspectRuntimeStateHealth } from "./fs-utils.js";
import {
  runLocalCapabilityReadinessChecks,
  validateLocalCapabilities,
  validateMcpServers,
} from "./mcp-config.js";
import { getMcpBridgeConfiguration, mcpClientVersion } from "./mcp-live-client.js";
import { getMcpRootPath, getRepoRoot, getRuntimeWritePath, packageRoot } from "./paths.js";
import { safeSpawnSync } from "./process-utils.js";
import { resolveReleaseIssueGates } from "./release-issue-gates.js";
import { loadReleaseState } from "./release-state.js";
import { getArchitectReviewConfiguration } from "./runtime/architect-review.js";
import { printDoctorStatuses, summarizeDoctorStatuses } from "./runtime/doctor-report.js";
import { mcpWriteCapabilityStatus } from "./runtime/mcp-authority.js";
import { loadObsidianVaultConfig } from "./runtime/obsidian-integration-core.js";
import { inspectRedactionVault } from "./runtime/redaction-gateway.js";
import { loadLeaderAuthority, loadRuntimeSnapshot } from "./runtime/runtime-state.js";
import { findOutdatedSchemas } from "./runtime/schema-migrations.js";
import { inspectSetupDrift } from "./setup-lifecycle.js";
import {
  areSkillsInstalled,
  ensureSkillsInstalled,
  ensureSupportBundleInstalled,
  getSkillInstallRoot,
  getSupportBundleRoot,
  isSupportBundleInstalled,
  readInstallReceipt,
} from "./skill-installer.js";
import { runInit } from "./skills.js";
import { renderCheckGrid } from "./tui/status-grid.js";

function makeStatus(kind, label, detail = "") {
  return { kind, label, detail };
}

function inspectMcpBridge() {
  const template = process.env.MA_MCP_REMOTE_BRIDGE_CMD?.trim();
  if (!template) return makeStatus("OK", "MCP remote bridge", "not configured");
  const command = template.split(/\s+/, 1)[0].replace(/^['"]|['"]$/g, "");
  const policy = getMcpBridgeConfiguration();
  const allowed = policy.allowedCommands.some(
    (entry) => entry === command || path.basename(entry) === path.basename(command),
  );
  return makeStatus(
    allowed ? "OK" : "WARN",
    "MCP remote bridge",
    allowed
      ? `${command} is explicitly allowlisted (${policy.source})`
      : `${command} is not allowlisted; configure MA_MCP_REMOTE_BRIDGE_ALLOWLIST or mcp/bridge.json`,
  );
}

function inspectArchitectReview() {
  const template = process.env.MA_ARCHITECT_REVIEW_CMD?.trim();
  if (!template) return makeStatus("OK", "external architect review", "not configured");
  const command = template.split(/\s+/, 1)[0].replace(/^['"]|['"]$/g, "");
  const policy = getArchitectReviewConfiguration();
  const allowed = policy.allowedCommands.some(
    (entry) => entry === command || path.basename(entry) === path.basename(command),
  );
  return makeStatus(
    allowed ? "OK" : "WARN",
    "external architect review",
    allowed
      ? `${command} is explicitly allowlisted (${policy.source})`
      : `${command} is not allowlisted; configure MA_ARCHITECT_REVIEW_ALLOWLIST or .ma/architect-review-policy.json`,
  );
}

export async function inspectWorkspaceNpmrc() {
  const npmrcPath = path.join(getRepoRoot(), ".npmrc");
  try {
    const content = await fs.readFile(npmrcPath, "utf8");
    const hasAuthMaterial = /(?:_authToken|_auth|_password|username)\s*=|token\s*=/i.test(content);
    return makeStatus(
      hasAuthMaterial ? "WARN" : "OK",
      "workspace npm auth",
      hasAuthMaterial
        ? "token-bearing .npmrc detected; use NODE_AUTH_TOKEN or a temporary config outside the workspace"
        : "no token-bearing .npmrc detected",
    );
  } catch (error) {
    if (error?.code === "ENOENT")
      return makeStatus("OK", "workspace npm auth", "no workspace .npmrc");
    return makeStatus("WARN", "workspace npm auth", `unable to inspect .npmrc: ${error.message}`);
  }
}

async function inspectPluginInjectionState() {
  const root = path.join(os.homedir(), ".ma", "backups", "plugins");
  try {
    const plugins = await fs.readdir(root, { withFileTypes: true });
    const receipts = [];
    for (const plugin of plugins) {
      if (!plugin.isDirectory()) continue;
      const runs = await fs.readdir(path.join(root, plugin.name), { withFileTypes: true });
      for (const run of runs.filter((entry) => entry.isDirectory())) {
        const receiptPath = path.join(root, plugin.name, run.name, "receipt.json");
        try {
          receipts.push(JSON.parse(await fs.readFile(receiptPath, "utf8")));
        } catch {
          // Ignore incomplete backup directories.
        }
      }
    }
    const latest = receipts.sort((a, b) => `${b.backupRoot}`.localeCompare(`${a.backupRoot}`))[0];
    const hosts = latest?.vendorInjection?.configured_hosts ?? [];
    return makeStatus(
      "OK",
      "plugin MCP injection state",
      hosts.length > 0 ? `configured hosts: ${hosts.join(", ")}` : "no recorded vendor mutations",
    );
  } catch {
    return makeStatus("OK", "plugin MCP injection state", "no recorded vendor mutations");
  }
}

async function inspectContextHealth() {
  const contextPath = getRuntimeWritePath("context", "project-index.json");
  const briefPath = getRuntimeWritePath("context", "agent-brief.md");
  const hookPath = path.join(getRepoRoot(), ".codex", "hooks.json");
  try {
    const project = JSON.parse(await fs.readFile(contextPath, "utf8"));
    const brief = await fs.readFile(briefPath, "utf8");
    const hooks = JSON.parse(await fs.readFile(hookPath, "utf8"));
    const hookText = JSON.stringify(hooks);
    const hydrated =
      hookText.includes("context-hydration-hook.mjs") ||
      hookText.includes("ma hook context-hydration");
    const hookFiles = [];
    const collectHookCommands = (value) => {
      if (Array.isArray(value)) return value.forEach(collectHookCommands);
      if (!value || typeof value !== "object") return;
      if (typeof value.command === "string") hookFiles.push(value.command);
      Object.values(value).forEach(collectHookCommands);
    };
    collectHookCommands(hooks);
    const brokenHookCommands = [];
    for (const command of hookFiles) {
      const relative = command.match(/^node\s+([^\s]+)/)?.[1];
      if (!relative) continue;
      try {
        await fs.access(path.resolve(getRepoRoot(), relative));
      } catch {
        brokenHookCommands.push(relative);
      }
    }
    const freshness = project.freshness?.status ?? "unknown";
    const outdated = await findOutdatedSchemas(getRepoRoot());
    const runtimeFindings = await inspectRuntimeStateHealth(getRepoRoot());
    const setupDrift = await inspectSetupDrift(getRepoRoot());
    const mcpWriteStatus = mcpWriteCapabilityStatus();
    return [
      makeStatus(
        setupDrift.length ? "WARN" : "OK",
        "seeded artifact drift",
        setupDrift.length
          ? setupDrift.map((entry) => `${entry.status}: ${entry.path}`).join(", ")
          : "no managed template drift",
      ),
      makeStatus(
        runtimeFindings.length ? "WARN" : "OK",
        "runtime state integrity",
        runtimeFindings.length
          ? runtimeFindings.map((finding) => `${finding.type}: ${finding.path}`).join(", ")
          : "atomic writes and locks healthy",
      ),
      makeStatus(
        freshness === "stale" ? "WARN" : "OK",
        "project context freshness",
        `${freshness}; ${project.quality?.confidence ?? "unknown"} confidence`,
      ),
      makeStatus(brief.trim() ? "OK" : "WARN", "agent context brief", briefPath),
      makeStatus(
        hydrated ? "OK" : "WARN",
        "startup/prompt context hydration",
        hydrated ? hookPath : "run `ma setup`",
      ),
      makeStatus(
        brokenHookCommands.length ? "WARN" : "OK",
        "hook command portability",
        brokenHookCommands.length
          ? `missing: ${brokenHookCommands.join(", ")}`
          : "all local hook scripts are present",
      ),
      makeStatus(
        "OK",
        "Obsidian integration",
        (await loadObsidianVaultConfig())?.vaultPath || process.env.MA_OBSIDIAN_VAULT
          ? "configured"
          : "not configured (explicitly disabled)",
      ),
      await inspectRedactionVault().then((vault) =>
        makeStatus(
          vault.status === "warning" ? "WARN" : "OK",
          "redaction vault policy",
          vault.issues.length > 0
            ? vault.issues.join(", ")
            : `${vault.policy.retentionDays}d retention, ${vault.policy.maxEntries} max entries`,
        ),
      ),
      await inspectWorkspaceNpmrc(),
      makeStatus("OK", "MCP context resources", "local read-only context capability available"),
      makeStatus(
        mcpWriteStatus.readOnly ? "WARN" : "OK",
        "MCP write authority",
        mcpWriteStatus.detail,
      ),
      makeStatus(
        outdated.length ? "WARN" : "OK",
        "runtime schema versions",
        outdated.length ? `${outdated.length} outdated artifact(s); run ma migrate` : "current",
      ),
    ];
  } catch (_error) {
    return [
      makeStatus(
        "WARN",
        "project context health",
        "Run `ma setup` to generate bounded context artifacts",
      ),
    ];
  }
}

function inspectAgent(type = process.env.MA_AGENT || "codex") {
  const result = detectInstalled(type);
  return {
    ok: result.installed,
    detail: result.error || `${getAgent(type).displayName} command failed`,
    version: result.version,
  };
}

function listCodexPaths() {
  const result = safeSpawnSync("which", ["-a", "codex"], { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    return [];
  }

  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function isWindowsPathInWsl(value) {
  return value.startsWith("/mnt/") && value.includes("/AppData/Roaming/npm/");
}

async function writeCodexWrapper() {
  const wrapperDir = path.join(os.homedir(), ".local", "bin");
  const wrapperPath = path.join(wrapperDir, "codex");
  const content = `#!/usr/bin/env bash
set -euo pipefail

if command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
  NODE_DIR="$(dirname "$NODE_BIN")"
  if [ -x "$NODE_DIR/codex" ] && [ "$NODE_DIR/codex" != "$0" ]; then
    exec "$NODE_DIR/codex" "$@"
  fi
fi

while IFS= read -r candidate; do
  [ -n "$candidate" ] || continue
  if [ "$candidate" = "$0" ]; then
    continue
  fi
  case "$candidate" in
    /mnt/*) continue ;;
  esac
  exec "$candidate" "$@"
done < <(which -a codex 2>/dev/null || true)

echo "Unable to locate a Linux Codex binary. Reinstall with: npm install -g @openai/codex@latest" >&2
exit 1
  `;

  await fs.mkdir(wrapperDir, { recursive: true });
  await fs.writeFile(wrapperPath, content, { mode: 0o755 });
  await fs.chmod(wrapperPath, 0o755);
  const pathEntries = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  if (!pathEntries.includes(wrapperDir)) {
    process.env.PATH = [wrapperDir, ...pathEntries].join(path.delimiter);
  }
  return wrapperPath;
}

async function inspectCodexResolution({ fix }) {
  if (process.platform !== "linux") {
    return null;
  }

  const paths = listCodexPaths();
  if (paths.length === 0) {
    return null;
  }

  const first = paths[0];
  const linuxAlternative = paths.find((candidate) => !isWindowsPathInWsl(candidate));
  if (!isWindowsPathInWsl(first) || !linuxAlternative) {
    return null;
  }

  if (!fix) {
    return makeStatus(
      "WARN",
      "codex path points at a Windows npm install inside WSL",
      `Preferred path is ${first}; Linux alternative exists at ${linuxAlternative}`,
    );
  }

  const wrapperPath = await writeCodexWrapper();
  return makeStatus(
    "FIXED",
    "codex path will prefer a Linux wrapper inside WSL",
    `Installed wrapper at ${wrapperPath}`,
  );
}

async function inspectLocalScaffold() {
  const requiredFiles = [
    getRuntimeWritePath("decisions.json"),
    getRuntimeWritePath("release.json"),
    getRuntimeWritePath("guidance", "merged.json"),
    getRuntimeWritePath("guidance", "include-graph.json"),
    getRuntimeWritePath("context", "active-autonomy-core.json"),
    getRuntimeWritePath("context", "capability-composition.json"),
    getRuntimeWritePath("context", "code-graph-rehearse.json"),
    getRuntimeWritePath("context", "core-source-ingest.json"),
    getRuntimeWritePath("context", "learning-loop-core.json"),
    getRuntimeWritePath("context", "project-index.json"),
    getRuntimeWritePath("context", "obsidian-bridge.json"),
    getRuntimeWritePath("context", "obsidian-vault-index.json"),
    getRuntimeWritePath("context", "obsidian-vault-operations.json"),
    getRuntimeWritePath("context", "prompt-strategy-core.json"),
    getRuntimeWritePath("context", "recording-core.json"),
    getRuntimeWritePath("context", "skills-registry-export.json"),
    getRuntimeWritePath("context", "workspace-virtualizer.json"),
    getRuntimeWritePath("context", "workspace-context-pack.json"),
    getRuntimeWritePath("context", "workspace-effectiveness.json"),
    getRuntimeWritePath("memory", "notes.md"),
    getRuntimeWritePath("memory", "index.json"),
    getRuntimeWritePath("hooks", "config.json"),
    getRuntimeWritePath("hooks", "audit.log"),
    getRuntimeWritePath("tasks", "registry.json"),
    getRuntimeWritePath("tasks", "mailbox"),
    getRuntimeWritePath("tasks", "locks"),
    getRuntimeWritePath("workspaces", "index.json"),
    getRuntimeWritePath("state", "manager-runs.json"),
    getRuntimeWritePath("state", "maestro-state.json"),
    getRuntimeWritePath("evidence", "semantic-receipts.json"),
    resolveReleaseIssueGates(getRepoRoot())?.path ??
      path.join(getRepoRoot(), "docs", "qa", "release-issue-gates-missing.json"),
    path.join(getMcpRootPath(), "servers.json"),
    path.join(getMcpRootPath(), "local-capabilities.json"),
  ];

  for (const file of requiredFiles) {
    try {
      await fs.access(file);
    } catch {
      return false;
    }
  }

  try {
    await loadReleaseState();
    await loadDecisionLog();
    const authority = await loadLeaderAuthority();
    if (authority.state === "invalid") {
      return false;
    }
    const snapshot = await loadRuntimeSnapshot();
    if (snapshot.missingArtifacts.length > 0 || snapshot.invalidArtifacts.length > 0) {
      return false;
    }
  } catch {
    return false;
  }

  return true;
}

async function seedStarterMcpConfig() {
  const files = ["servers.json", "collections.json", "fallback.json"];
  for (const file of files) {
    await fs.copyFile(path.join(packageRoot, "mcp", file), path.join(getMcpRootPath(), file));
  }
}

async function seedLocalCapabilityManifest() {
  await fs.copyFile(
    path.join(packageRoot, "mcp", "local-capabilities.json"),
    path.join(getMcpRootPath(), "local-capabilities.json"),
  );
}

async function inspectGitMcpState({ fix, initMcp }) {
  try {
    const servers = await validateMcpServers();
    if (servers.servers.length === 0) {
      if (fix && initMcp) {
        await seedStarterMcpConfig();
        const seededServers = await validateMcpServers();
        return makeStatus(
          "FIXED",
          "repo-owned GitMCP evidence sources were seeded into mcp/servers.json",
          `${seededServers.servers.length} configured source(s)`,
        );
      }

      return makeStatus(
        "WARN",
        "repo-owned mcp/servers.json contains no approved GitMCP evidence sources",
        initMcp
          ? "Run `ma bootstrap --init-mcp` to seed starter sources, or add exact upstream GitMCP repo endpoints manually."
          : "Add exact upstream GitMCP repo endpoints before claiming VERIFIED evidence.",
      );
    }

    return makeStatus(
      "OK",
      "repo-owned mcp/servers.json is ready for GitMCP evidence binding",
      `${servers.servers.length} configured source(s)`,
    );
  } catch (error) {
    if (fix && initMcp) {
      await seedStarterMcpConfig();
      const seededServers = await validateMcpServers();
      return makeStatus(
        "FIXED",
        "repo-owned mcp/servers.json was reseeded with starter GitMCP evidence sources",
        `${seededServers.servers.length} configured source(s)`,
      );
    }

    return makeStatus(
      "WARN",
      "repo-owned mcp/servers.json is not ready for GitMCP evidence binding",
      error.message,
    );
  }
}

async function inspectLocalCapabilityState({ fix }) {
  function summarizeReadiness(readiness) {
    const notReady = readiness.filter((item) => !item.ready);
    const allReady = notReady.length === 0;
    return {
      allReady,
      detail: allReady
        ? readiness.map((item) => item.capability).join(", ")
        : notReady.map((item) => `${item.capability}: ${item.detail}`).join("; "),
    };
  }

  try {
    await validateLocalCapabilities();
    const summary = summarizeReadiness(await runLocalCapabilityReadinessChecks());
    if (!summary.allReady) {
      return makeStatus(
        "WARN",
        "package-owned mcp/local-capabilities.json is valid but some local capabilities are not ready",
        summary.detail,
      );
    }

    return makeStatus(
      "OK",
      "package-owned mcp/local-capabilities.json is ready for first-party capabilities",
      summary.detail,
    );
  } catch (error) {
    if (fix) {
      await seedLocalCapabilityManifest();
      const summary = summarizeReadiness(await runLocalCapabilityReadinessChecks());
      return makeStatus(
        summary.allReady ? "FIXED" : "WARN",
        summary.allReady
          ? "package-owned mcp/local-capabilities.json was reseeded from the bundled SDK"
          : "package-owned mcp/local-capabilities.json was reseeded but some local capabilities are not ready",
        summary.detail,
      );
    }

    return makeStatus(
      "WARN",
      "package-owned mcp/local-capabilities.json is not ready for first-party capabilities",
      error.message,
    );
  }
}

async function runEnvironmentFlow({ fix, initMcp }) {
  const statuses = [makeStatus("OK", "MCP client version", mcpClientVersion)];
  statuses.push(inspectMcpBridge());
  statuses.push(inspectArchitectReview());

  const agentType = process.env.MA_AGENT?.trim() || "codex";
  const agent = getAgent(agentType);
  const codexResolution = agentType === "codex" ? await inspectCodexResolution({ fix }) : null;
  if (codexResolution) {
    statuses.push(codexResolution);
  }

  const installed = inspectAgent(agentType);
  if (installed.ok) {
    statuses.push(makeStatus("OK", `${agent.displayName} command is available`, installed.version));
  } else {
    statuses.push(
      makeStatus(
        "BLOCKED",
        `${agent.displayName} command is not usable`,
        installed.detail || "Install or repair the selected agent command.",
      ),
    );
  }

  const skillInstallRoot = getSkillInstallRoot(agent.id);
  if (fix) {
    const result = await ensureSkillsInstalled();
    statuses.push(
      makeStatus(
        result.installed.length > 0 ? "FIXED" : "OK",
        `${agent.displayName} skills are installed`,
        skillInstallRoot,
      ),
    );
  } else {
    const receipt = await readInstallReceipt(skillInstallRoot, "skills");
    statuses.push(
      makeStatus(
        (await areSkillsInstalled()) ? "OK" : "WARN",
        `${agent.displayName} skills install state`,
        receipt
          ? `${skillInstallRoot} (v${receipt.packageVersion}, receipt present)`
          : `${skillInstallRoot} (receipt missing)`,
      ),
    );
  }

  const supportBundleRoot = getSupportBundleRoot();
  if (agent.id !== "codex") {
    statuses.push(
      makeStatus("OK", "Codex support bundle", "not applicable to the selected agent surface"),
    );
  } else if (fix) {
    const result = await ensureSupportBundleInstalled();
    statuses.push(
      makeStatus(
        result.installed.length > 0 ? "FIXED" : "OK",
        "support bundle is installed",
        supportBundleRoot,
      ),
    );
  } else {
    const receipt = await readInstallReceipt(supportBundleRoot, "support");
    statuses.push(
      makeStatus(
        (await isSupportBundleInstalled()) ? "OK" : "WARN",
        "support bundle install state",
        receipt
          ? `${supportBundleRoot} (v${receipt.bundleVersion}, receipt present)`
          : `${supportBundleRoot} (receipt missing)`,
      ),
    );
  }

  if (fix) {
    await runInit();
    const scaffoldReady = await inspectLocalScaffold();
    statuses.push(
      makeStatus(
        scaffoldReady ? "FIXED" : "WARN",
        scaffoldReady
          ? "local Meta-Architect scaffold is ready"
          : "local Meta-Architect scaffold still has invalid runtime artifacts",
        path.join(getRepoRoot(), ".ma"),
      ),
    );
  } else {
    statuses.push(
      makeStatus(
        (await inspectLocalScaffold()) ? "OK" : "WARN",
        "local Meta-Architect scaffold state",
        path.join(getRepoRoot(), ".ma"),
      ),
    );
  }

  statuses.push(await inspectGitMcpState({ fix, initMcp }));
  statuses.push(await inspectLocalCapabilityState({ fix }));
  statuses.push(...(await inspectContextHealth()));
  statuses.push(await inspectPluginInjectionState());
  return statuses;
}

function printStatuses(title, statuses) {
  if (process.stdout.isTTY) {
    const result = summarizeDoctorStatuses(statuses);
    console.log(title);
    console.log("=".repeat(title.length));
    console.log(renderCheckGrid(statuses));
    console.log(`\nResult: ${result}`);
    console.log(
      result === "BLOCKED"
        ? "Next: install or repair blocked prerequisites, then rerun `ma bootstrap`."
        : "Next: start Codex or run `ma run '$maestro'`.",
    );
    return result;
  }
  const result = printDoctorStatuses(title, statuses);
  if (result === "BLOCKED") {
    console.log("Next: install or repair blocked prerequisites, then rerun `ma bootstrap`.");
  } else if (result === "READY_WITH_WARNINGS") {
    console.log("Next: review warnings, then start Codex or run `ma run '$maestro'`.");
  } else {
    console.log("Next: start Codex or run `ma run '$maestro'`.");
  }
  return result;
}

export async function runDoctor({ json = false } = {}) {
  const statuses = await runEnvironmentFlow({ fix: false, initMcp: false });
  const result = summarizeDoctorStatuses(statuses);
  if (json) return { schemaVersion: "0.1.0", scope: "environment", result, statuses };
  return {
    statuses,
    result: printStatuses("Meta-Architect Doctor", statuses),
  };
}

export async function runBootstrap({ initMcp = false, json = false } = {}) {
  const statuses = await runEnvironmentFlow({ fix: true, initMcp });
  const result = summarizeDoctorStatuses(statuses);
  if (json) return { schemaVersion: "0.1.0", scope: "bootstrap", result, statuses };
  return {
    statuses,
    result: printStatuses("Meta-Architect Bootstrap", statuses),
  };
}
