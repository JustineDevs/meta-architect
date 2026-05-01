#!/usr/bin/env node

import {
  evaluateBuildGate,
  formatBuildBlockers,
  formatNextAllowedTriggers,
} from "../src/build-gate.js";
import { appendDecision } from "../src/decision-log.js";
import { runCodex, shouldDelegateToCodex } from "../src/launcher.js";
import {
  canMarkBuildDone,
  rejectsDirectProdPromotion,
  validateMergeTarget,
  validateReleaseOrigin,
} from "../src/policy.js";
import { loadReleaseState } from "../src/release-state.js";
import {
  listSkills,
  runArch,
  runFlow,
  runIdea,
  runInit,
  runSage,
  runVet,
  runVibe,
} from "../src/skills.js";
import { syncStatusUpdates } from "../src/state-sync.js";

function printUsage() {
  console.error("Usage:");
  console.error("  ma");
  console.error("  ma setup");
  console.error("  ma init");
  console.error('  ma idea "..."');
  console.error("  ma skills");
  console.error("  ma status");
  console.error("  ma run $arch|$sage|$flow|$vet|$vibe|$build");
  console.error("  ma merge <source-branch> <target-branch>");
  console.error("  ma release <origin-branch> <target-branch>");
}

function printStatus(releaseState) {
  console.log("Meta-Architect Status");
  console.log("=====================");
  console.log(`Idea: ${releaseState.idea_status}`);
  console.log(`Architecture: ${releaseState.architecture_status}`);
  console.log(`Evidence: ${releaseState.evidence_status}`);
  console.log(`Logic: ${releaseState.logic_status}`);
  console.log(`Security: ${releaseState.security_status}`);
  console.log(`Experience: ${releaseState.experience_status}`);
  console.log(`Build: ${releaseState.build_status}`);

  const evaluation = evaluateBuildGate(releaseState);
  console.log("Next allowed triggers:");
  const triggers = formatNextAllowedTriggers(evaluation);
  if (triggers.length === 0) {
    console.log("$build");
    return;
  }

  for (const trigger of triggers) {
    console.log(trigger);
  }
}

async function runBuild(releaseState) {
  const evaluation = evaluateBuildGate(releaseState);

  if (!evaluation.allowed) {
    const blockers = formatBuildBlockers(evaluation);
    await appendDecision({
      decision: "Blocked build execution",
      status: "BLOCKED",
      evidence: [
        {
          kind: "release-state",
          path: ".meta-architect/release.json",
        },
      ],
      blockers,
      next_allowed_triggers: formatNextAllowedTriggers(evaluation),
    });

    console.error("Build is locked.");
    for (const blocker of blockers) {
      console.error(`- ${blocker}`);
    }
    process.exitCode = 1;
    return;
  }

  await appendDecision({
    kind: "skill",
    skill: "$build",
    decision: "Build gate ready",
    status: "READY",
    evidence: [
      {
        kind: "release-state",
        path: ".meta-architect/release.json",
      },
      {
        branches: ["feature/ui", "feature/api"],
      },
    ],
    blockers: [],
    next_allowed_triggers: ["$build"],
  });

  await syncStatusUpdates({ build_status: "READY" });

  console.log("Build gate is green.");
  console.log("Suggested branches:");
  console.log("- feature/ui");
  console.log("- feature/api");
  console.log("Optional worktree commands:");
  console.log("git worktree add ../ui feature/ui");
  console.log("git worktree add ../api feature/api");
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

  if (command === "status") {
    const releaseState = await loadReleaseState();
    printStatus(releaseState);
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

  if (command === "run" && arg === "$build") {
    const releaseState = await loadReleaseState();
    await runBuild(releaseState);
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
