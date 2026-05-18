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
import { evaluateRuntimeBuildReadiness } from "../src/runtime/build-readiness.js";
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
  console.error("  ma sdk-path");
  console.error("  ma status");
  console.error("  ma run $maestro|$arch|$sage|$flow|$vet|$vibe|$build");
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

async function runBuild() {
  const result = await runBuildLane();
  if (result.status !== "READY") {
    console.error("Build is locked.");
    for (const blocker of result.blockers) {
      console.error(`- ${blocker}`);
    }
    process.exitCode = 1;
    return;
  }

  const suggestedBranches = result.suggestedBranches ?? [];
  console.log("Build gate is green.");
  console.log("Suggested branches:");
  for (const branch of suggestedBranches) {
    console.log(`- ${branch}`);
  }
  console.log("Optional worktree commands:");
  console.log("git worktree add ../implementation feature/implementation");
  console.log("git worktree add ../verification feature/verification");
}

async function runMerge(sourceBranch, targetBranch) {
  const releaseState = await loadReleaseState();

  if (!validateMergeTarget(sourceBranch, targetBranch)) {
    throw new Error("Merge policy violation: only feature/* -> development is allowed");
  }

  if (!canMarkBuildDone(releaseState)) {
    throw new Error("Merge is blocked until build status is READY or RUNNING");
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
    build_status: "DONE",
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

  if (command === "sdk-path") {
    process.stdout.write(`${getSupportBundleRoot()}\n`);
    return;
  }

  if (command === "status") {
    const releaseState = await loadReleaseState();
    await printStatus(releaseState);
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
    await runMaestro();
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
