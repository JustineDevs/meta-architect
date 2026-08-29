#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveAgentCommand } from "../src/agents.js";
import { runBootstrap, runDoctor } from "../src/bootstrap.js";
import { appendDecision } from "../src/decision-log.js";
import { runAgent, shouldDelegateToCodex } from "../src/launcher.js";
import { getRepoRoot, packageRoot } from "../src/paths.js";
import {
  canMarkBuildDone,
  rejectsDirectProdPromotion,
  validateMergeTarget,
  validateReleaseOrigin,
} from "../src/policy.js";
import { choosePrelaunchInstall, installPrelaunchSelection } from "../src/prelaunch.js";
import { executeGitOperation, inspectGitOperation } from "../src/release-operations.js";
import { loadReleaseState } from "../src/release-state.js";
import {
  compileAgentIntegrations,
  detectAgentEnvironments,
  listAgentCompatAdapters,
  validateAgentIntegrations,
} from "../src/runtime/agent-compat.js";
import { runExternalArchitectReview } from "../src/runtime/architect-review.js";
import {
  cancelAutonomousTask,
  enqueueAutonomousTasks,
  loadTaskQueue,
  parseTaskInput,
  runAutonomousTasks,
} from "../src/runtime/autonomous-tasks.js";
import { evaluateRuntimeBuildReadiness } from "../src/runtime/build-readiness.js";
import { ingestCoreSources } from "../src/runtime/core-source-ingest.js";
import { verifyLiveAgentMatrix } from "../src/runtime/live-agent-verification.js";
import { createMaestroView, formatMaestroView } from "../src/runtime/maestro-output.js";
import {
  appendObsidianOperationReceipt,
  configureObsidianVault,
  createObsidianNote,
  deleteObsidianNote,
  listObsidianNotes,
  readObsidianNote,
  updateObsidianNote,
  writeObsidianVaultIndex,
} from "../src/runtime/obsidian-integration-core.js";
import { installObsidianPlugin } from "../src/runtime/obsidian-plugin-bridge.js";
import { refreshProjectIndex } from "../src/runtime/project-context.js";
import { purgeRedactionVault } from "../src/runtime/redaction-gateway.js";
import { createRuntimeSummary, loadRuntimeSnapshot } from "../src/runtime/runtime-state.js";
import { migrateSchemas } from "../src/runtime/schema-migrations.js";
import { rollbackSetup } from "../src/setup-lifecycle.js";
import {
  ensureSkillsInstalled,
  ensureSupportBundleInstalled,
  getSupportBundleRoot,
} from "../src/skill-installer.js";
import {
  listSkills,
  runArch,
  runBuildLane,
  runFlow,
  runIdea,
  runInit,
  runMaestro,
  runSage,
  runVet,
  runVibe,
} from "../src/skills.js";
import { syncStatusUpdates } from "../src/state-sync.js";
import { renderReleaseGrid } from "../src/tui/status-grid.js";

function printUsage() {
  console.log("Meta-Architect CLI");
  console.log("Usage: ma <command> [options]");
  console.log("\nCommands:");
  console.log("  ma");
  console.log("  ma bootstrap [--init-mcp]");
  console.log("  ma doctor [--json]");
  console.log("  ma welcome");
  console.log("  ma context refresh [--full|--json]");
  console.log("  ma migrate [--dry-run|--rollback|--json]");
  console.log("  ma setup [--obsidian-vault <path>]");
  console.log("  first interactive launch: choose project or user scope and detected hosts");
  console.log("  ma setup --rollback");
  console.log("  ma setup --rollback --dry-run");
  console.log("  ma uninstall");
  console.log("  ma init");
  console.log('  ma idea "..."');
  console.log("  ma skills");
  console.log("  ma core-ingest [--refresh]");
  console.log("  ma agent-compat adapters|detect|compile|validate [path]");
  console.log(
    "  ma obsidian configure|list|read|create|update|delete|plugin-install [vault-path] [note-path] [content]",
  );
  console.log("  ma obsidian-index [vault-path]");
  console.log(
    "  ma obsidian list|read|create|update|delete|plugin-install <vault-path> [note-path] [content]",
  );
  console.log("  ma sdk-path");
  console.log("  ma status [--maestro-view]");
  console.log("  ma verify --architect|--agents-live [--json]");
  console.log("  ma run $maestro|$arch|$sage|$flow|$vet|$vibe|$build [--auto-heal] [--parallel]");
  console.log(
    "  ma task add <goal> [--priority <level>] [--depends-on <id,...>] [--label <name>] [--deadline <ISO>]",
  );
  console.log("  ma task bulk <file|-> [--format json|yaml]");
  console.log("  ma task list [--json]");
  console.log("  ma task run [--concurrency <n>] [--max-tasks <n>] [--json]");
  console.log("  ma task cancel <id> [reason]");
  console.log("  ma hook active-autonomy|context-hydration");
  console.log("  ma redaction purge [--dry-run]");
  console.log("  ma merge <source-branch> <target-branch> [--dry-run|--execute]");
  console.log("  ma release <origin-branch> <target-branch> [--dry-run|--execute]");
}

async function printVersion() {
  const metadata = JSON.parse(await fs.readFile(path.join(packageRoot, "package.json"), "utf8"));
  console.log(metadata.version);
}

function printCommandHelp(command) {
  const help = {
    setup: "ma setup [--json] [--obsidian-vault <path>] [--rollback] [--dry-run]",
    doctor: "ma doctor [--json]",
    status: "ma status [--json] [--maestro-view]",
    context: "ma context refresh [--full] [--json]",
    migrate: "ma migrate [--dry-run|--rollback] [--json]",
    merge: "ma merge <source-branch> <target-branch> [--dry-run|--execute]",
    release: "ma release <origin-branch> <target-branch> [--dry-run|--execute]",
    "agent-compat": "ma agent-compat adapters|detect|compile|validate [path]",
    verify: "ma verify --architect|--agents-live [--json]",
    task: "ma task add|bulk|list|run|cancel ...",
  };
  console.log(help[command] ?? `No command-specific help is available for '${command}'.`);
}

function taskOption(rest, name) {
  const value = getOptionValue(rest, name);
  return value === undefined ? undefined : value;
}

async function runTaskCommand(rest) {
  const action = rest[0] ?? "list";
  if (action === "add") {
    const flags = new Set([
      "--priority",
      "--depends-on",
      "--label",
      "--deadline",
      "--id",
      "--vendor",
    ]);
    const goal = rest
      .slice(1)
      .filter((value, index, values) => {
        if (index > 0 && flags.has(values[index - 1])) return false;
        return !value.startsWith("--") && !flags.has(value);
      })
      .join(" ");
    if (!goal) throw new Error("Usage: ma task add <goal>");
    const task = {
      id: taskOption(rest, "--id"),
      goal,
      priority: taskOption(rest, "--priority"),
      dependencies: taskOption(rest, "--depends-on")?.split(",").filter(Boolean),
      labels: taskOption(rest, "--label")?.split(",").filter(Boolean),
      deadline: taskOption(rest, "--deadline"),
      vendor: taskOption(rest, "--vendor"),
    };
    const [added] = await enqueueAutonomousTasks(task);
    console.log(
      rest.includes("--json")
        ? JSON.stringify(added, null, 2)
        : `Queued ${added.id}: ${added.goal}`,
    );
    return;
  }
  if (action === "bulk") {
    const source = rest[1];
    if (!source) throw new Error("Usage: ma task bulk <file|-> [--format json|yaml]");
    const raw =
      source === "-"
        ? await new Promise((resolve, reject) => {
            const chunks = [];
            process.stdin.on("data", (chunk) => chunks.push(chunk));
            process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
            process.stdin.on("error", reject);
          })
        : await fs.readFile(source, "utf8");
    const format =
      taskOption(rest, "--format") ??
      (source.endsWith(".yaml") || source.endsWith(".yml") ? "yaml" : "json");
    const added = await enqueueAutonomousTasks(await parseTaskInput(raw, format));
    console.log(
      rest.includes("--json") ? JSON.stringify(added, null, 2) : `Queued ${added.length} task(s)`,
    );
    return;
  }
  if (action === "list") {
    const queue = await loadTaskQueue();
    console.log(JSON.stringify(queue.tasks, null, 2));
    return;
  }
  if (action === "cancel") {
    if (!rest[1]) throw new Error("Usage: ma task cancel <id> [reason]");
    const task = await cancelAutonomousTask(
      rest[1],
      rest
        .slice(2)
        .filter((value) => !value.startsWith("--"))
        .join(" ") || undefined,
    );
    console.log(rest.includes("--json") ? JSON.stringify(task, null, 2) : `Cancelled ${task.id}`);
    return;
  }
  if (action === "run") {
    const result = await runAutonomousTasks({
      concurrency: Number(taskOption(rest, "--concurrency") ?? 1),
      maxTasks: Number(taskOption(rest, "--max-tasks") ?? Infinity),
    });
    if (rest.includes("--json")) console.log(JSON.stringify(result, null, 2));
    else
      console.log(
        `Autonomous tasks: ${Object.entries(result.summary)
          .map(([key, value]) => `${key}=${value}`)
          .join(" ")}`,
      );
    if (result.summary.failed > 0 || result.summary.blocked > 0) process.exitCode = 1;
    return;
  }
  throw new Error(`Unknown task action: ${action}`);
}

function getOptionValue(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function runHook(name) {
  const scripts = {
    "active-autonomy": "active-autonomy-hook.mjs",
    "context-hydration": "context-hydration-hook.mjs",
  };
  const script = scripts[name];
  if (!script) throw new Error(`Unknown hook: ${name}`);
  const result = spawnSync(process.execPath, [path.join(packageRoot, "scripts", script)], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

async function readObsidianContent(args, fallback) {
  const filePath = getOptionValue(args, "--file");
  if (filePath) return fs.readFile(filePath, "utf8");
  if (args.includes("--stdin")) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString("utf8");
  }
  return fallback;
}

async function runAgentCompatCommand(rest) {
  const [action = "adapters", firstArg, secondArg] = rest;
  if (action === "adapters") {
    console.log(JSON.stringify(listAgentCompatAdapters(), null, 2));
    return;
  }

  if (action === "detect") {
    console.log(JSON.stringify(await detectAgentEnvironments(firstArg ?? process.cwd()), null, 2));
    return;
  }

  if (action === "validate") {
    console.log(
      JSON.stringify(await validateAgentIntegrations(firstArg ?? process.cwd()), null, 2),
    );
    return;
  }

  if (action === "compile") {
    if (!firstArg) {
      throw new Error("Usage: ma agent-compat compile <manifest.json> [output]");
    }
    const manifest = JSON.parse(await fs.readFile(firstArg, "utf8"));
    const result = await compileAgentIntegrations(manifest, {
      output: secondArg ?? process.cwd(),
    });
    console.log(JSON.stringify(result, null, 2));
    if (!result.success) process.exitCode = 1;
    return;
  }

  throw new Error(`Unknown Agent Compat action: ${action}`);
}

async function printStatus(releaseState, { json = false } = {}) {
  const runtimeSummary = createRuntimeSummary(await loadRuntimeSnapshot());
  const evaluation = evaluateRuntimeBuildReadiness(releaseState, runtimeSummary);
  const payload = {
    schemaVersion: "0.1.0",
    scope: "status",
    release: releaseState,
    runtime: runtimeSummary,
    nextTriggers: evaluation.nextTriggers,
  };
  if (json) {
    console.log(JSON.stringify(payload, null, 2));
    return payload;
  }
  console.log("Meta-Architect Status");
  console.log("=====================");
  if (process.stdout.isTTY) {
    console.log(renderReleaseGrid(releaseState, evaluation.nextTriggers));
  }
  if (process.stdout.isTTY) {
    console.log(
      `Core source snapshots: ${runtimeSummary.coreSourceIngestCount} (${runtimeSummary.coreSourceIngestStatus})`,
    );
    console.log(`Obsidian vault notes: ${runtimeSummary.obsidianVaultNoteCount}`);
    console.log(`Obsidian CRUD receipts: ${runtimeSummary.obsidianVaultOperationCount}`);
  }
  if (!process.stdout.isTTY) {
    console.log(`Idea: ${releaseState.idea_status}`);
    console.log(`Architecture: ${releaseState.architecture_status}`);
    console.log(`Evidence: ${releaseState.evidence_status}`);
    console.log(`Logic: ${releaseState.logic_status}`);
    console.log(`Security: ${releaseState.security_status}`);
    console.log(`Experience: ${releaseState.experience_status}`);
    console.log(`Build: ${releaseState.build_status}`);

    console.log(
      `Core source snapshots: ${runtimeSummary.coreSourceIngestCount} (${runtimeSummary.coreSourceIngestStatus})`,
    );
    console.log(`Obsidian vault notes: ${runtimeSummary.obsidianVaultNoteCount}`);
    console.log(`Obsidian CRUD receipts: ${runtimeSummary.obsidianVaultOperationCount}`);
  }
  if (
    releaseState.build_status === "DONE" &&
    releaseState.merge_status !== "MERGED_TO_DEVELOPMENT"
  ) {
    console.log("Next allowed triggers:");
    console.log("ma merge <feature/*> development");
    return;
  }
  console.log("Next allowed triggers:");
  const triggers = evaluation.nextTriggers;
  if (triggers.length === 0) {
    console.log("$build");
    return;
  }

  for (const trigger of triggers) {
    console.log(trigger);
  }
}

async function printMaestroView({ json = false, snapshot = null } = {}) {
  const currentSnapshot = snapshot ?? (await loadRuntimeSnapshot());
  const view = createMaestroView(currentSnapshot.maestroState);
  if (json) return view;
  process.stdout.write(formatMaestroView(view));
}

async function runBuild() {
  const result = await runBuildLane();
  if (result.status === "BLOCKED") {
    console.error("Build is locked.");
    for (const blocker of result.blockers) {
      console.error(`- ${blocker}`);
    }
    process.exitCode = 1;
    return;
  }

  if (result.status === "READY") {
    const suggestedBranches = result.suggestedBranches ?? [];
    console.log("Build gate is ready.");
    console.log("Suggested branches:");
    for (const branch of suggestedBranches) {
      console.log(`- ${branch}`);
    }
    console.log("Optional worktree commands:");
    console.log("git worktree add ../implementation feature/implementation");
    console.log("git worktree add ../verification feature/verification");
    console.log("Run `ma run '$build'` again to start the bounded build execution substep.");
    return;
  }

  if (result.status === "RUNNING") {
    console.log("Build gate is running the bounded execution substep.");
    console.log(
      "Run `ma run '$build'` again to finalize the substep and persist completion evidence.",
    );
    return;
  }

  console.log("Build gate completed the bounded execution substep.");
  console.log("Next step: ma merge <feature/*> development");
}

async function runMerge(sourceBranch, targetBranch, mode = "approval") {
  const releaseState = await loadReleaseState();

  if (!validateMergeTarget(sourceBranch, targetBranch)) {
    throw new Error("Merge policy violation: only feature/* -> development is allowed");
  }

  if (!canMarkBuildDone(releaseState)) {
    throw new Error("Merge is blocked until build status is DONE");
  }

  const operation = await inspectGitOperation(getRepoRoot(), sourceBranch, targetBranch);
  if (!operation.available || !operation.sourceExists || !operation.clean) {
    throw new Error(`Git preflight failed: ${operation.blockers.join("; ")}`);
  }
  if (mode === "dry-run") {
    console.log(
      `DRY RUN: approval state unchanged; would execute ${operation.display} on ${targetBranch}`,
    );
    return;
  }
  if (mode === "execute") {
    if (operation.currentBranch !== targetBranch) {
      throw new Error(
        `Git execute requires current branch ${targetBranch}; found ${operation.currentBranch || "detached HEAD"}`,
      );
    }
    await executeGitOperation(getRepoRoot(), operation);
  }

  await appendDecision({
    kind: "merge",
    decision: `Merge approved from ${sourceBranch} to ${targetBranch}`,
    status: "MERGED_TO_DEVELOPMENT",
    evidence: [{ sourceBranch, targetBranch }],
    blockers: [],
    next_allowed_triggers: ["release"],
  });

  await syncStatusUpdates({
    merge_status: "MERGED_TO_DEVELOPMENT",
  });

  console.log(
    mode === "execute"
      ? `Merge executed and approved: ${sourceBranch} -> ${targetBranch}`
      : `Merge approved only: ${sourceBranch} -> ${targetBranch}; no Git command executed. Run \`${operation.display}\` explicitly or use --execute.`,
  );
}

async function runRelease(originBranch, targetBranch, mode = "approval") {
  const releaseState = await loadReleaseState();

  if (targetBranch !== "prod") {
    throw new Error("Release policy violation: target branch must be prod");
  }

  if (rejectsDirectProdPromotion(originBranch) || !validateReleaseOrigin(originBranch)) {
    throw new Error(
      "Release policy violation: only development or approved release/* can promote to prod",
    );
  }

  if (releaseState.merge_status !== "MERGED_TO_DEVELOPMENT") {
    throw new Error("Release is blocked until merge_status is MERGED_TO_DEVELOPMENT");
  }

  const operation = await inspectGitOperation(getRepoRoot(), originBranch, targetBranch);
  if (!operation.available || !operation.sourceExists || !operation.clean) {
    throw new Error(`Git preflight failed: ${operation.blockers.join("; ")}`);
  }
  if (mode === "dry-run") {
    console.log(
      `DRY RUN: approval state unchanged; would execute ${operation.display} on ${targetBranch}`,
    );
    return;
  }
  if (mode === "execute") {
    if (operation.currentBranch !== targetBranch) {
      throw new Error(
        `Git execute requires current branch ${targetBranch}; found ${operation.currentBranch || "detached HEAD"}`,
      );
    }
    await executeGitOperation(getRepoRoot(), operation);
  }

  await appendDecision({
    kind: "release",
    decision: `Release approved from ${originBranch} to ${targetBranch}`,
    status: "SHIPPED_TO_PROD",
    evidence: [{ originBranch, targetBranch }],
    blockers: [],
    next_allowed_triggers: [],
  });

  await syncStatusUpdates({
    release_status: "SHIPPED_TO_PROD",
  });

  console.log(
    mode === "execute"
      ? `Release executed and approved: ${originBranch} -> ${targetBranch}`
      : `Release approved only: ${originBranch} -> ${targetBranch}; no Git command executed. Run \`${operation.display}\` explicitly or use --execute.`,
  );
}

function resolveGitMode(args) {
  const modes = [
    args.includes("--dry-run") && "dry-run",
    args.includes("--execute") && "execute",
  ].filter(Boolean);
  if (modes.length > 1) throw new Error("Choose only one of --dry-run or --execute");
  return modes[0] ?? "approval";
}

async function main() {
  const [, , command, ...rest] = process.argv;
  const args = process.argv.slice(2);
  const arg = rest[0];

  if (args[0] === "--help" || args[0] === "-h" || args[0] === "help") {
    if (args[0] === "help" && args[1]) printCommandHelp(args[1]);
    else printUsage();
    return;
  }
  if (args[0] === "--version" || args[0] === "-v" || args[0] === "version") {
    await printVersion();
    return;
  }
  if (args.includes("--help")) {
    printCommandHelp(command);
    return;
  }

  if (command === "hook") {
    runHook(arg);
    return;
  }

  if (command === "task") {
    await runTaskCommand(rest);
    return;
  }

  if (command === "redaction" && rest[0] === "purge") {
    const result = await purgeRedactionVault({ dryRun: rest.includes("--dry-run") });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (shouldDelegateToCodex(args)) {
    const selection = await choosePrelaunchInstall();
    const agentType = process.env.MA_AGENT || selection?.targets?.[0] || "codex";
    if (selection) {
      await installPrelaunchSelection(selection);
    } else if (process.env.MA_AGENT) {
      await installPrelaunchSelection({
        schemaVersion: "0.1.0",
        scope: "project",
        targets: [agentType],
      });
    } else {
      await Promise.all([ensureSkillsInstalled(), ensureSupportBundleInstalled()]);
    }
    if (!resolveAgentCommand(agentType)) {
      console.log(
        `Installed ${agentType} compatibility files; no executable host command is registered, so delegation was skipped.`,
      );
      return;
    }
    process.exitCode = runAgent(args, agentType);
    return;
  }

  if (command === "setup") {
    const jsonOutput = args.includes("--json");
    if (args.includes("--rollback")) {
      const result = await rollbackSetup(getRepoRoot(), { dryRun: args.includes("--dry-run") });
      if (jsonOutput) console.log(JSON.stringify(result, null, 2));
      else console.log(`${result.status}: ${result.removed.length} artifact(s) removed`);
      return;
    }
    const report = await runInit({
      refresh: args.includes("--refresh"),
      obsidianVault: getOptionValue(args, "--obsidian-vault"),
    });
    if (
      [...report.directories, ...report.files].some(
        (entry) => entry.status === "warning" || entry.status === "warned" || entry.fatal === true,
      )
    ) {
      process.exitCode = 1;
    }
    if (jsonOutput) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    console.log("meta-architect setup");
    console.log("====================");
    for (const entry of [...report.directories, ...report.files]) {
      const suffix = entry.warning ? `: ${entry.warning}` : "";
      console.log(`${entry.status}: ${entry.path}${suffix}`);
    }
    for (const integration of report.integrations ?? []) {
      console.log(`${integration.status}: ${integration.vaultPath}/${integration.notePath}`);
    }
    if (report.context) {
      console.log(
        `context: ${report.context.path} (${report.context.status}, ${report.context.completeness})`,
      );
      if (report.context.unknown.length > 0) {
        console.log(`context unknown: ${report.context.unknown.join(", ")}`);
      }
    }
    console.log("next: ma doctor | ma context refresh | ma setup --rollback");
    return;
  }

  if (command === "welcome") {
    const outcome = await runDoctor();
    console.log("Meta-Architect welcome");
    console.log("=======================");
    console.log("Context: .ma/context/project-index.json");
    console.log(
      "Agents read: .ma/context/agent-brief.md, .ma/context/project-index.json, AGENTS.md",
    );
    console.log("Next: ma doctor | ma context refresh | ma setup --rollback");
    process.exitCode = outcome.result === "BLOCKED" ? 1 : 0;
    return;
  }

  if (command === "context" && rest[0] === "refresh") {
    const result = await refreshProjectIndex(getRepoRoot(), {
      mode: rest.includes("--full") ? "full" : "incremental",
    });
    const receipt = await fs.readFile(`${getRepoRoot()}/.ma/context/refresh-receipt.json`, "utf8");
    if (rest.includes("--json")) console.log(receipt);
    else {
      console.log(`context refresh: ${result.freshness.status}`);
      console.log(`changed: ${result.freshness.changedFiles.length}`);
      console.log(`affected: ${JSON.parse(receipt).affectedArtifacts.join(", ") || "none"}`);
    }
    return;
  }

  if (command === "uninstall") {
    const result = await rollbackSetup(getRepoRoot());
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "bootstrap") {
    const outcome = await runBootstrap({
      initMcp: rest.includes("--init-mcp"),
      json: rest.includes("--json"),
    });
    if (rest.includes("--json")) console.log(JSON.stringify(outcome, null, 2));
    process.exitCode = outcome.result === "BLOCKED" ? 1 : 0;
    return;
  }

  if (command === "doctor") {
    const outcome = await runDoctor({ json: rest.includes("--json") });
    if (rest.includes("--json")) console.log(JSON.stringify(outcome, null, 2));
    process.exitCode = outcome.result === "BLOCKED" ? 1 : 0;
    return;
  }

  if (command === "migrate") {
    const result = await migrateSchemas(getRepoRoot(), {
      dryRun: rest.includes("--dry-run"),
      rollback: rest.includes("--rollback"),
    });
    if (rest.includes("--json")) console.log(JSON.stringify(result, null, 2));
    else
      console.log(
        `${result.status}: ${(result.migrated ?? result.restored ?? []).length} artifact(s)`,
      );
    process.exitCode = result.status === "failed" ? 1 : 0;
    return;
  }

  if (command === "init") {
    const report = await runInit({
      refresh: args.includes("--refresh"),
      obsidianVault: getOptionValue(args, "--obsidian-vault"),
    });
    console.log("meta-architect init");
    console.log("===================");
    for (const entry of [...report.directories, ...report.files]) {
      const suffix = entry.warning ? `: ${entry.warning}` : "";
      console.log(`${entry.status}: ${entry.path}${suffix}`);
    }
    return;
  }

  if (command === "idea") {
    const idea = rest.join(" ").trim();
    await runIdea(idea);
    console.log("Idea recorded.");
    return;
  }

  if (command === "skills") {
    for (const skill of listSkills()) {
      console.log(skill);
    }
    return;
  }

  if (command === "core-ingest") {
    await runInit();
    const manifest = await ingestCoreSources({ refresh: rest.includes("--refresh") });
    console.log("Core sources ingested");
    console.log(`Status: ${manifest.status}`);
    console.log(`Runtime fetch required: ${manifest.runtime_fetch_required}`);
    for (const source of manifest.sources) {
      console.log(`${source.id}: ${source.status} ${source.local_path ?? source.repo}`);
    }
    if (manifest.errors?.length > 0) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "agent-compat") {
    await runAgentCompatCommand(rest);
    return;
  }

  if (command === "obsidian-index") {
    await runInit();
    const index = await writeObsidianVaultIndex({ vaultPath: arg });
    console.log("Obsidian vault indexed");
    console.log(`Vault: ${index.vault_path}`);
    console.log(`Notes: ${index.note_count}`);
    console.log(`Tags: ${index.tags.length}`);
    console.log(`Unresolved links: ${index.unresolved_links.length}`);
    return;
  }

  if (command === "obsidian") {
    const [action, vaultPath, notePath, ...contentParts] = rest;
    if (!action) {
      throw new Error(
        "Usage: ma obsidian list|read|create|update|delete|plugin-install <vault-path> [note-path] [content]",
      );
    }
    await runInit();
    if (action === "configure") {
      const config = await configureObsidianVault(vaultPath);
      console.log(`Obsidian vault configured: ${config.vaultPath}`);
      return;
    }
    if (action === "plugin-install") {
      const receipt = await installObsidianPlugin({ vaultPath });
      await appendObsidianOperationReceipt({
        record_type: "obsidian_vault_operation",
        operation: "plugin_install",
        records_as: "vault_context",
        build_evidence: false,
        authority_boundary: "$maestro_or_owning_lane",
        vault_path: receipt.vault_path,
        relative_path: ".obsidian/plugins/meta-architect",
        content_sha256: "0".repeat(64),
        char_count: receipt.installed_files.join("\n").length,
        performed_at: new Date().toISOString(),
      });
      console.log("Obsidian plugin installed");
      console.log(`Vault: ${receipt.vault_path}`);
      console.log(`Plugin: ${receipt.plugin_path}`);
      console.log(`Enabled: ${receipt.enabled}`);
      console.log(`Files: ${receipt.installed_files.join(", ")}`);
      return;
    }
    if (action === "list") {
      const list = await listObsidianNotes({ vaultPath });
      console.log(`Obsidian notes: ${list.notes.length}`);
      for (const note of list.notes) {
        console.log(note);
      }
      return;
    }
    if (action === "read") {
      const note = await readObsidianNote({ vaultPath, notePath });
      console.log(`Obsidian note: ${note.relative_path}`);
      console.log(note.content);
      return;
    }
    if (action === "create") {
      const content = await readObsidianContent(rest, contentParts.join(" "));
      if (rest.includes("--dry-run")) {
        console.log(
          JSON.stringify(
            { schemaVersion: "0.1.0", status: "would_create", notePath, content },
            null,
            2,
          ),
        );
        return;
      }
      const receipt = await createObsidianNote({
        vaultPath,
        notePath,
        content,
      });
      await appendObsidianOperationReceipt(receipt);
      await writeObsidianVaultIndex({ vaultPath });
      console.log(`Obsidian note created: ${receipt.relative_path}`);
      return;
    }
    if (action === "update") {
      const content = await readObsidianContent(rest, contentParts.join(" "));
      if (rest.includes("--dry-run")) {
        const existing = await readObsidianNote({ vaultPath, notePath });
        console.log(
          JSON.stringify(
            {
              schemaVersion: "0.1.0",
              status: existing.content === content ? "unchanged" : "would_update",
              notePath,
              content,
            },
            null,
            2,
          ),
        );
        return;
      }
      const receipt = await updateObsidianNote({
        vaultPath,
        notePath,
        content,
      });
      await appendObsidianOperationReceipt(receipt);
      await writeObsidianVaultIndex({ vaultPath });
      console.log(`Obsidian note updated: ${receipt.relative_path}`);
      return;
    }
    if (action === "delete") {
      const receipt = await deleteObsidianNote({ vaultPath, notePath });
      await appendObsidianOperationReceipt(receipt);
      await writeObsidianVaultIndex({ vaultPath });
      console.log(`Obsidian note deleted: ${receipt.relative_path}`);
      return;
    }
    throw new Error(`Unknown Obsidian action: ${action}`);
  }

  if (command === "sdk-path") {
    process.stdout.write(`${getSupportBundleRoot()}\n`);
    return;
  }

  if (command === "status") {
    const releaseState = await loadReleaseState();
    const json = rest.includes("--json");
    const snapshot = rest.includes("--maestro-view") ? await loadRuntimeSnapshot() : null;
    if (json && snapshot) {
      const runtime = createRuntimeSummary(snapshot);
      const evaluation = evaluateRuntimeBuildReadiness(releaseState, runtime);
      const status = {
        schemaVersion: "0.1.0",
        scope: "status",
        release: releaseState,
        runtime,
        nextTriggers: evaluation.nextTriggers,
        maestro: createMaestroView(snapshot.maestroState),
      };
      process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
    } else {
      await printStatus(releaseState, { json });
      if (snapshot) await printMaestroView({ snapshot });
    }
    return;
  }

  if (command === "verify" && rest.includes("--architect")) {
    const review = await runExternalArchitectReview({
      prompt:
        "Review the current Meta-Architect runtime and release-state outputs for architectural soundness.",
    });
    console.log(`Architect verdict: ${review.verdict}`);
    if (review.summary) {
      console.log(review.summary);
    }
    return;
  }

  if (command === "verify" && rest.includes("--agents-live")) {
    const report = await verifyLiveAgentMatrix({ cwd: process.cwd() });
    if (rest.includes("--json")) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      console.log(`Agent live verification: ${report.target_count} targets`);
      console.log(`Runtime verified: ${report.runtime_verified}`);
      console.log(`Distribution only: ${report.distribution_only}`);
      console.log(`Blocked: ${report.blocked}`);
      for (const result of report.results) {
        console.log(
          `- ${result.target}: ${result.status}${result.reason ? ` (${result.reason})` : ""}`,
        );
      }
    }
    return;
  }

  if (command === "merge") {
    const [sourceBranch, targetBranch] = rest.filter((arg) => !arg.startsWith("--"));
    await runMerge(sourceBranch, targetBranch, resolveGitMode(rest));
    return;
  }

  if (command === "release") {
    const [originBranch, targetBranch] = rest.filter((arg) => !arg.startsWith("--"));
    await runRelease(originBranch, targetBranch, resolveGitMode(rest));
    return;
  }

  if (command === "run" && arg === "$maestro") {
    await runMaestro({
      autoHeal: rest.includes("--auto-heal"),
      parallel: rest.includes("--parallel"),
    });
    console.log("$maestro complete");
    return;
  }

  if (command === "run" && arg === "$meta-architect") {
    throw new Error("$meta-architect has been removed as a separate surface; use $maestro");
  }

  if (command === "run" && arg === "$build") {
    await runBuild();
    return;
  }

  if (command === "run" && arg === "$arch") {
    await runArch();
    console.log("$arch complete");
    return;
  }

  if (command === "run" && arg === "$sage") {
    await runSage();
    console.log("$sage complete");
    return;
  }

  if (command === "run" && arg === "$flow") {
    await runFlow();
    console.log("$flow complete");
    return;
  }

  if (command === "run" && arg === "$vet") {
    await runVet();
    console.log("$vet complete");
    return;
  }

  if (command === "run" && arg === "$vibe") {
    await runVibe();
    console.log("$vibe complete");
    return;
  }

  printUsage();
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
