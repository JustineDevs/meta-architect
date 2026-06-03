#!/usr/bin/env node

import { runBootstrap, runDoctor } from "../src/bootstrap.js";
import { appendDecision } from "../src/decision-log.js";
import { runCodex, shouldDelegateToCodex } from "../src/launcher.js";
import {
  canMarkBuildDone,
  rejectsDirectProdPromotion,
  validateMergeTarget,
  validateReleaseOrigin,
} from "../src/policy.js";
import { loadReleaseState } from "../src/release-state.js";
import { runExternalArchitectReview } from "../src/runtime/architect-review.js";
import { evaluateRuntimeBuildReadiness } from "../src/runtime/build-readiness.js";
import { ingestCoreSources } from "../src/runtime/core-source-ingest.js";
import {
  appendObsidianOperationReceipt,
  createObsidianNote,
  deleteObsidianNote,
  listObsidianNotes,
  readObsidianNote,
  updateObsidianNote,
  writeObsidianVaultIndex,
} from "../src/runtime/obsidian-integration-core.js";
import { installObsidianPlugin } from "../src/runtime/obsidian-plugin-bridge.js";
import { createRuntimeSummary, loadRuntimeSnapshot } from "../src/runtime/runtime-state.js";
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

function printUsage() {
  console.error("Secondary helper commands:");
  console.error("  ma");
  console.error("  ma bootstrap [--init-mcp]");
  console.error("  ma doctor");
  console.error("  ma setup");
  console.error("  ma init");
  console.error('  ma idea "..."');
  console.error("  ma skills");
  console.error("  ma core-ingest [--refresh]");
  console.error("  ma obsidian-index [vault-path]");
  console.error(
    "  ma obsidian list|read|create|update|delete|plugin-install <vault-path> [note-path] [content]",
  );
  console.error("  ma sdk-path");
  console.error("  ma status [--maestro-view]");
  console.error("  ma verify --architect");
  console.error("  ma run $maestro|$arch|$sage|$flow|$vet|$vibe|$build [--auto-heal] [--parallel]");
  console.error("  ma merge <source-branch> <target-branch>");
  console.error("  ma release <origin-branch> <target-branch>");
}

async function printStatus(releaseState) {
  console.log("Meta-Architect Status");
  console.log("=====================");
  console.log(`Idea: ${releaseState.idea_status}`);
  console.log(`Architecture: ${releaseState.architecture_status}`);
  console.log(`Evidence: ${releaseState.evidence_status}`);
  console.log(`Logic: ${releaseState.logic_status}`);
  console.log(`Security: ${releaseState.security_status}`);
  console.log(`Experience: ${releaseState.experience_status}`);
  console.log(`Build: ${releaseState.build_status}`);

  const runtimeSummary = createRuntimeSummary(await loadRuntimeSnapshot());
  console.log(
    `Core source snapshots: ${runtimeSummary.coreSourceIngestCount} (${runtimeSummary.coreSourceIngestStatus})`,
  );
  console.log(`Obsidian vault notes: ${runtimeSummary.obsidianVaultNoteCount}`);
  console.log(`Obsidian CRUD receipts: ${runtimeSummary.obsidianVaultOperationCount}`);
  if (
    releaseState.build_status === "DONE" &&
    releaseState.merge_status !== "MERGED_TO_DEVELOPMENT"
  ) {
    console.log("Next allowed triggers:");
    console.log("ma merge <feature/*> development");
    return;
  }
  const evaluation = evaluateRuntimeBuildReadiness(releaseState, runtimeSummary);
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

async function printMaestroView() {
  const snapshot = await loadRuntimeSnapshot();
  const trackEntries = Object.entries(snapshot.maestroState.runtime_tracks);
  console.log("Maestro View");
  console.log("============");
  console.log(`Global status: ${snapshot.maestroState.global_status}`);
  console.log(`Orchestration id: ${snapshot.maestroState.orchestration_id ?? "not started"}`);
  console.log("Runtime tracks:");
  if (trackEntries.length === 0) {
    console.log("- none");
  } else {
    for (const [trackId, track] of trackEntries) {
      console.log(`- ${trackId}: ${track.active_gate} [${track.status}]`);
      if (Array.isArray(track.blockers) && track.blockers.length > 0) {
        console.log(`  blockers: ${track.blockers.join("; ")}`);
      }
    }
  }

  const lockEntries = Object.entries(snapshot.maestroState.downstream_lock_table);
  console.log("Downstream locks:");
  if (lockEntries.length === 0) {
    console.log("- none");
    return;
  }

  for (const [gate, lock] of lockEntries) {
    console.log(`- ${gate}: ${lock.is_locked ? "locked" : "unlocked"}`);
    if (Array.isArray(lock.locked_by) && lock.locked_by.length > 0) {
      console.log(`  locked by: ${lock.locked_by.join(", ")}`);
    }
    if (lock.unlock_criteria) {
      console.log(`  unlock criteria: ${lock.unlock_criteria}`);
    }
  }
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

async function runMerge(sourceBranch, targetBranch) {
  const releaseState = await loadReleaseState();

  if (!validateMergeTarget(sourceBranch, targetBranch)) {
    throw new Error("Merge policy violation: only feature/* -> development is allowed");
  }

  if (!canMarkBuildDone(releaseState)) {
    throw new Error("Merge is blocked until build status is DONE");
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

  console.log(`Merge approved: ${sourceBranch} -> ${targetBranch}`);
}

async function runRelease(originBranch, targetBranch) {
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

  console.log(`Release approved: ${originBranch} -> ${targetBranch}`);
}

async function main() {
  const [, , command, ...rest] = process.argv;
  const args = process.argv.slice(2);
  const arg = rest[0];

  if (shouldDelegateToCodex(args)) {
    await Promise.all([ensureSkillsInstalled(), ensureSupportBundleInstalled()]);
    process.exitCode = runCodex(args);
    return;
  }

  if (command === "setup") {
    const created = await runInit();
    console.log("meta-architect setup");
    console.log("====================");
    for (const item of created) {
      console.log(`ready: ${item}`);
    }
    return;
  }

  if (command === "bootstrap") {
    const outcome = await runBootstrap({ initMcp: rest.includes("--init-mcp") });
    process.exitCode = outcome.result === "BLOCKED" ? 1 : 0;
    return;
  }

  if (command === "doctor") {
    const outcome = await runDoctor();
    process.exitCode = outcome.result === "BLOCKED" ? 1 : 0;
    return;
  }

  if (command === "init") {
    const created = await runInit();
    console.log("meta-architect init");
    console.log("===================");
    for (const item of created) {
      console.log(`ready: ${item}`);
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

  if (command === "obsidian-index") {
    const vaultPath = arg ?? process.env.MA_OBSIDIAN_VAULT;
    if (!vaultPath) {
      throw new Error("Obsidian vault path required: ma obsidian-index <vault-path>");
    }
    await runInit();
    const index = await writeObsidianVaultIndex({ vaultPath });
    console.log("Obsidian vault indexed");
    console.log(`Vault: ${index.vault_path}`);
    console.log(`Notes: ${index.note_count}`);
    console.log(`Tags: ${index.tags.length}`);
    console.log(`Unresolved links: ${index.unresolved_links.length}`);
    return;
  }

  if (command === "obsidian") {
    const [action, vaultPath, notePath, ...contentParts] = rest;
    if (!action || !vaultPath) {
      throw new Error(
        "Usage: ma obsidian list|read|create|update|delete|plugin-install <vault-path> [note-path] [content]",
      );
    }
    await runInit();
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
      const receipt = await createObsidianNote({
        vaultPath,
        notePath,
        content: contentParts.join(" "),
      });
      await appendObsidianOperationReceipt(receipt);
      await writeObsidianVaultIndex({ vaultPath });
      console.log(`Obsidian note created: ${receipt.relative_path}`);
      return;
    }
    if (action === "update") {
      const receipt = await updateObsidianNote({
        vaultPath,
        notePath,
        content: contentParts.join(" "),
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
    await printStatus(releaseState);
    if (rest.includes("--maestro-view")) {
      await printMaestroView();
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

  if (command === "merge") {
    const [sourceBranch, targetBranch] = rest;
    await runMerge(sourceBranch, targetBranch);
    return;
  }

  if (command === "release") {
    const [originBranch, targetBranch] = rest;
    await runRelease(originBranch, targetBranch);
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
