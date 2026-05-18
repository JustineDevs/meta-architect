import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadDecisionLog } from "./decision-log.js";
import {
  runLocalCapabilityReadinessChecks,
  validateLocalCapabilities,
  validateMcpServers,
} from "./mcp-config.js";
import { getMcpRootPath, getRepoRoot, getRuntimeWritePath, packageRoot } from "./paths.js";
import { loadReleaseState } from "./release-state.js";
import { loadLeaderAuthority, loadRuntimeSnapshot } from "./runtime/runtime-state.js";
import {
  areSkillsInstalled,
  ensureSkillsInstalled,
  ensureSupportBundleInstalled,
  getSkillInstallRoot,
  getSupportBundleRoot,
  isSupportBundleInstalled,
} from "./skill-installer.js";
import { runInit } from "./skills.js";

function makeStatus(kind, label, detail = "") {
  return { kind, label, detail };
}

function resolveCodexCommand() {
  return process.env.MA_CODEX_BIN ?? "codex";
}

function runCommand(command, args) {
  const isNodeScript = [".js", ".mjs", ".cjs"].includes(path.extname(command));
  const finalCommand = isNodeScript ? process.execPath : command;
  const finalArgs = isNodeScript ? [command, ...args] : args;
  return spawnSync(finalCommand, finalArgs, { encoding: "utf8" });
}

function inspectCodex() {
  const command = resolveCodexCommand();
  const result = runCommand(command, ["--version"]);
  const version = result.stdout.trim();
  if (result.status === 0) {
    return {
      ok: true,
      command,
      detail: result.error?.message ?? "",
      version,
    };
  }

  return {
    ok: false,
    command,
    detail:
      (result.error?.message ?? result.stderr.trim() ?? result.stdout.trim()) ||
      "Codex command failed",
    version: "",
  };
}

function listCodexPaths() {
  const result = spawnSync("which", ["-a", "codex"], { encoding: "utf8" });
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
    getRuntimeWritePath("memory", "notes.md"),
    getRuntimeWritePath("memory", "index.json"),
    getRuntimeWritePath("hooks", "config.json"),
    getRuntimeWritePath("hooks", "audit.log"),
    getRuntimeWritePath("tasks", "registry.json"),
    getRuntimeWritePath("tasks", "mailbox"),
    getRuntimeWritePath("tasks", "locks"),
    getRuntimeWritePath("workspaces", "index.json"),
    getRuntimeWritePath("state", "manager-runs.json"),
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
  const statuses = [];

  const codexResolution = await inspectCodexResolution({ fix });
  if (codexResolution) {
    statuses.push(codexResolution);
  }

  const codex = inspectCodex();
  if (codex.ok) {
    statuses.push(makeStatus("OK", "codex command is available", codex.version));
  } else {
    statuses.push(
      makeStatus(
        "BLOCKED",
        "codex command is not usable",
        "Install or repair Codex with: npm install -g @openai/codex@latest",
      ),
    );
  }

  const skillInstallRoot = getSkillInstallRoot();
  if (fix) {
    const result = await ensureSkillsInstalled();
    statuses.push(
      makeStatus(
        result.installed.length > 0 ? "FIXED" : "OK",
        "Codex skills are installed",
        skillInstallRoot,
      ),
    );
  } else {
    statuses.push(
      makeStatus(
        (await areSkillsInstalled()) ? "OK" : "WARN",
        "Codex skills install state",
        skillInstallRoot,
      ),
    );
  }

  const supportBundleRoot = getSupportBundleRoot();
  if (fix) {
    const result = await ensureSupportBundleInstalled();
    statuses.push(
      makeStatus(
        result.installed.length > 0 ? "FIXED" : "OK",
        "support bundle is installed",
        supportBundleRoot,
      ),
    );
  } else {
    statuses.push(
      makeStatus(
        (await isSupportBundleInstalled()) ? "OK" : "WARN",
        "support bundle install state",
        supportBundleRoot,
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
  return statuses;
}

function summarizeStatuses(statuses) {
  const hasBlocked = statuses.some((status) => status.kind === "BLOCKED");
  const hasWarn = statuses.some((status) => status.kind === "WARN");
  if (hasBlocked) {
    return "BLOCKED";
  }
  if (hasWarn) {
    return "READY_WITH_WARNINGS";
  }
  return "READY";
}

function printStatuses(title, statuses) {
  console.log(title);
  console.log("=".repeat(title.length));
  for (const status of statuses) {
    const label = status.kind.padEnd(7, " ");
    if (status.detail) {
      console.log(`${label} ${status.label}: ${status.detail}`);
    } else {
      console.log(`${label} ${status.label}`);
    }
  }
  const result = summarizeStatuses(statuses);
  console.log();
  console.log(`Result: ${result}`);
  if (result === "BLOCKED") {
    console.log("Next: install or repair blocked prerequisites, then rerun `ma bootstrap`.");
  } else if (result === "READY_WITH_WARNINGS") {
    console.log("Next: review warnings, then start Codex or run `ma run '$maestro'`.");
  } else {
    console.log("Next: start Codex or run `ma run '$maestro'`.");
  }
  return result;
}

export async function runDoctor() {
  const statuses = await runEnvironmentFlow({ fix: false, initMcp: false });
  return {
    statuses,
    result: printStatuses("Meta-Architect Doctor", statuses),
  };
}

export async function runBootstrap({ initMcp = false } = {}) {
  const statuses = await runEnvironmentFlow({ fix: true, initMcp });
  return {
    statuses,
    result: printStatuses("Meta-Architect Bootstrap", statuses),
  };
}
