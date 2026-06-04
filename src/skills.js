import fs from "node:fs/promises";
import path from "node:path";
import { appendDecision } from "./decision-log.js";
import { readJson, writeFileIfMissing, writeJson } from "./fs-utils.js";
import { validateMcpServers } from "./mcp-config.js";
import { createMcpLiveClient, hasConfiguredMcpRemoteBridge } from "./mcp-live-client.js";
import { getRepoRoot, getRuntimeReadPath, getRuntimeWritePath, packageRoot } from "./paths.js";
import {
  evaluateAlignmentDrift,
  saveAlignmentSentinelReport,
} from "./runtime/alignment-sentinel.js";
import { evaluateRuntimeBuildReadiness } from "./runtime/build-readiness.js";
import {
  findIngestedCoreSourceForRepo,
  loadCoreSourceIngest,
} from "./runtime/core-source-ingest.js";
import { launchDetachedTrack } from "./runtime/detached-provider.js";
import {
  scanLockfilePackageExposure,
  validateMcpPolicyExposure,
} from "./runtime/exposure-catalog.js";
import { createHelperReceipt } from "./runtime/helper-orchestration-core.js";
import { appendMaestroEvent } from "./runtime/maestro-events.js";
import {
  buildHelperFailureMatrix,
  chooseMaestroManagerAction,
  createManagerRun,
  getActiveManagerRun,
  loadManagerRunRegistry,
  saveManagerRunRegistry,
} from "./runtime/maestro-manager.js";
import {
  beginMaestroOrchestration,
  loadMaestroStateOrDefault,
  saveMaestroState,
} from "./runtime/maestro-state.js";
import { submitTask } from "./runtime/orchestrator.js";
import {
  createQuorumReviewReceipt,
  evaluateQuorumVotes,
  quorumDecisions,
} from "./runtime/quorum-review.js";
import { writeRalphExecutionContract } from "./runtime/ralph-execution-core.js";
import { redactProviderBoundText, seedRedactionVault } from "./runtime/redaction-gateway.js";
import {
  assertLeaderAuthority,
  createRuntimeSummary,
  loadRuntimeSnapshot,
  repairRuntimeScratchpadArtifacts,
} from "./runtime/runtime-state.js";
import {
  seedRuntimeArtifacts,
  writeArchitectureArtifacts,
  writeBuildPlanArtifact,
  writeEvidenceSpec,
  writeExperienceSpec,
  writeLogicSpec,
  writeMaestroPlan,
  writeProjectContext,
  writeSecuritySpec,
} from "./runtime-artifacts.js";
import { syncStatusUpdates } from "./state-sync.js";

const skillNames = [
  "$maestro",
  "$arch",
  "$sage",
  "$flow",
  "$vet",
  "$vibe",
  "$build",
  "$align",
  "$diagnose",
  "$tdd",
  "$cleanup",
];
const maestroWorkflowSequence = ["$arch", "$sage", "$flow", "$vet", "$vibe", "$build"];
const workflowTemplates = {
  "maestro.skill.md":
    "# `$maestro`\n\nThe singular Meta-Architect umbrella workflow. Inspect runtime state, execute bounded helper or gated work when it is safe, persist the manager-run control plane, and return the exact next trigger.\n",
  "arch.skill.md":
    "# `$arch`\n\nProduces blueprint architecture, stack rationale, subsystem design, and tradeoffs.\n",
  "sage.skill.md":
    "# `$sage`\n\nMaps architectural choices to approved OSS candidates from GitMCP-backed collections.\n",
  "vet.skill.md": "# `$vet`\n\nAudits security posture, CVE signals, and safer alternatives.\n",
  "flow.skill.md": "# `$flow`\n\nValidates logic, state transitions, and unresolved blockers.\n",
  "vibe.skill.md":
    "# `$vibe`\n\nReviews developer and user experience risks before build execution.\n",
  "build.skill.md": "# `$build`\n\nChecks gates and plans bounded build execution.\n",
  "align.skill.md":
    "# `$align`\n\nHelper skill for scope alignment, shared language, and docs clarity. Non-gating.\n",
  "diagnose.skill.md":
    "# `$diagnose`\n\nHelper skill for blocked-lane diagnosis and root-cause slicing. Non-gating.\n",
  "tdd.skill.md":
    "# `$tdd`\n\nHelper skill for regression-first or test-first preparation. Non-gating.\n",
  "cleanup.skill.md":
    "# `$cleanup`\n\nHelper skill for simplification, anti-slop cleanup, and final-pass polish. Non-gating.\n",
  "sync.skill.md":
    "# `$sync`\n\nReserved for refreshing mapped MCP sources and availability records.\n",
};

export function listSkills() {
  return skillNames;
}

function chooseMaestroRecommendation(releaseState, idea, buildReadiness = null) {
  if (releaseState.idea_status !== "CLEAR") {
    return {
      nextStep: "Capture or refine the project brief before any design or validation lane starts.",
      why: "The workflow still needs a concrete brief before architecture or build decisions can be trusted.",
      primaryLane: "brief capture",
      supportLane: "none",
      assignments: ['Use `ma idea "..."` or provide the brief before running in-session skills.'],
      avoid: ["Do not start architecture or implementation yet."],
      nextTrigger: "`ma idea`",
    };
  }

  if (releaseState.architecture_status !== "APPROVED") {
    return {
      nextStep: "Run the architecture lane first.",
      why: "The brief exists, but the workflow still needs a concrete architecture before later gates can be trusted.",
      primaryLane: "$arch",
      supportLane: "$sage",
      assignments: [
        `Use $arch to shape the current brief${idea ? ` for: ${idea}` : ""}.`,
        "After approval, move into $sage for source-backed stack validation.",
      ],
      avoid: ["Do not jump to build or release work yet."],
      nextTrigger: "`$arch`",
    };
  }

  if (releaseState.evidence_status !== "VERIFIED") {
    return {
      nextStep: "Validate the architecture against approved sources.",
      why: "The architecture exists, but the evidence gate is not yet fully verified.",
      primaryLane: "$sage",
      supportLane: "$flow",
      assignments: [
        "Run $sage using the current architecture as the probe basis.",
        "Prepare to hand off to $flow after evidence is verified.",
      ],
      avoid: ["Do not treat stack choices as settled yet."],
      nextTrigger: "`$sage`",
    };
  }

  if (releaseState.logic_status !== "GREEN") {
    return {
      nextStep: "Validate system behavior and state transitions.",
      why: "Logic is the next unresolved gate before implementation readiness can be claimed.",
      primaryLane: "$flow",
      supportLane: "$vet",
      assignments: [
        "Run $flow to map actors, states, transitions, and blockers.",
        "Queue $vet after the logic lane confirms behavior is sound.",
      ],
      avoid: ["Do not merge or release yet."],
      nextTrigger: "`$flow`",
    };
  }

  if (releaseState.security_status !== "GREEN") {
    return {
      nextStep: "Run the security and trust-boundary review.",
      why: "Security is the next unresolved gate before the workflow can unlock implementation readiness.",
      primaryLane: "$vet",
      supportLane: "$vibe",
      assignments: [
        "Run $vet to capture trust boundaries, abuse cases, and mitigations.",
        "Move to $vibe once security is green.",
      ],
      avoid: ["Do not unlock implementation readiness before security review."],
      nextTrigger: "`$vet`",
    };
  }

  if (!["GREEN", "WAIVED"].includes(releaseState.experience_status)) {
    return {
      nextStep: "Review workflow clarity and friction before build unlock.",
      why: "The experience lane is the final quality gate before the build decision.",
      primaryLane: "$vibe",
      supportLane: "$build",
      assignments: [
        "Run $vibe to capture onboarding and operability friction.",
        "Move to $build only after experience is green or intentionally waived.",
      ],
      avoid: ["Do not start release promotion yet."],
      nextTrigger: "`$vibe`",
    };
  }

  if (releaseState.build_status === "LOCKED") {
    if (buildReadiness && buildReadiness.releaseBlockers.length === 0 && !buildReadiness.allowed) {
      return {
        nextStep: "Repair runtime artifacts before bounded build planning can unlock.",
        why: "The release gates are green, but runtime artifacts or pending mailbox proposals are still blocking build readiness.",
        primaryLane: "runtime repair",
        supportLane: "$build",
        assignments: [
          "Repair the listed runtime blockers first.",
          "Re-run $build only after runtime blockers are cleared.",
        ],
        avoid: ["Do not unlock bounded implementation planning while runtime blockers remain."],
        nextTrigger: "`repair runtime artifacts`",
      };
    }

    return {
      nextStep: "Unlock bounded implementation planning.",
      why: "All upstream quality gates are green, so the workflow can now evaluate build readiness.",
      primaryLane: "$build",
      supportLane: "implementation",
      assignments: [
        "Run $build to get the current build-readiness verdict.",
        "Use the resulting narrow build slice as the next execution assignment.",
      ],
      avoid: ["Do not release directly from a task branch."],
      nextTrigger: "`$build`",
    };
  }

  if (releaseState.build_status === "READY") {
    return {
      nextStep: "Start the bounded build execution substep.",
      why: "The build lane has prepared a narrow slice and verification plan, and the next safe move is to begin that bounded substep.",
      primaryLane: "$build",
      supportLane: "implementation",
      assignments: [
        "Run $build again to move the bounded build slice into active execution.",
        "Keep the slice reversible and lane-owned.",
      ],
      avoid: ["Do not merge or release before the bounded build slice is complete."],
      nextTrigger: "`$build`",
    };
  }

  if (releaseState.build_status === "RUNNING") {
    return {
      nextStep: "Finalize the bounded build execution substep.",
      why: "The build lane is already running its bounded slice and now needs completion evidence before downstream promotion.",
      primaryLane: "$build",
      supportLane: "verification",
      assignments: [
        "Run $build again to finalize the bounded build substep and persist completion evidence.",
      ],
      avoid: ["Do not merge or release before the build lane records DONE."],
      nextTrigger: "`$build`",
    };
  }

  if (releaseState.merge_status !== "MERGED_TO_DEVELOPMENT") {
    return {
      nextStep: "Finish the implementation slice and merge it into development.",
      why: "The build gate is ready or done, but the branch promotion path has not completed yet.",
      primaryLane: "implementation",
      supportLane: "merge",
      assignments: [
        "Use the current build plan to finish the smallest viable implementation slice.",
        "When ready, merge feature work into development with `ma merge`.",
      ],
      avoid: ["Do not promote directly to prod."],
      nextTrigger: "`ma merge <feature/*> development`",
    };
  }

  if (releaseState.release_status !== "SHIPPED_TO_PROD") {
    return {
      nextStep: "Promote the approved release line to prod.",
      why: "Implementation and merge gates are complete, so the remaining step is the controlled release promotion.",
      primaryLane: "release",
      supportLane: "verification",
      assignments: [
        "Verify the origin branch is development or an approved release branch.",
        "Run `ma release <origin> prod` when the line is ready.",
      ],
      avoid: ["Do not reopen earlier gates unless a new blocker appears."],
      nextTrigger: "`ma release <development|release/*> prod`",
    };
  }

  return {
    nextStep: "The workflow is already at the terminal release state.",
    why: "All gates, merge, and release states are complete.",
    primaryLane: "done",
    supportLane: "verification",
    assignments: ["Confirm final release evidence and start a new brief for the next cycle."],
    avoid: ["Do not rerun build or release steps without a new task."],
    nextTrigger: "`ma idea` or `$arch` for the next task",
  };
}

async function readIdeaText() {
  const decisions = await readJson(getRuntimeReadPath("decisions.json"));
  const ideaDecision = [...decisions.decisions].reverse().find((entry) => entry.kind === "idea");
  return ideaDecision?.idea ?? null;
}

async function readRuntimeSummary() {
  const runtimeSnapshot = await loadRuntimeSnapshot();
  return createRuntimeSummary(runtimeSnapshot);
}

function assertControlPlaneReady(runtimeSummary) {
  const blockingInvalidArtifacts = runtimeSummary.invalidArtifacts.filter((artifact) =>
    ["runtime.release", "runtime.decisions"].includes(artifact),
  );
  const blockingMissingArtifacts = runtimeSummary.missingArtifacts.filter(
    (artifact) => artifact === "runtime.decisions" || artifact === "runtime.release",
  );

  const blockingArtifacts = [...blockingInvalidArtifacts, ...blockingMissingArtifacts];
  if (blockingArtifacts.length > 0) {
    throw new Error(`Invalid runtime artifacts: ${blockingArtifacts.join(", ")}`);
  }
}

function getManagerDecisionStatus(managerRun) {
  return managerRun.state.toUpperCase().replaceAll("-", "_");
}

function stripBackticks(value) {
  return value.replaceAll("`", "");
}

function isGitMcpDocumentationTool(tool, action) {
  if (!tool || typeof tool.name !== "string") {
    return false;
  }
  if (!tool.name.startsWith(`${action}_`)) {
    return false;
  }
  if (tool.name === "fetch_generic_url_content") {
    return false;
  }

  const lowerName = tool.name.toLowerCase();
  return (
    lowerName.includes("_documentation") ||
    lowerName.includes("_docs") ||
    `${tool.description ?? ""}`.toLowerCase().includes("documentation")
  );
}

function createBoundedBuildSlice() {
  return [
    "Create or confirm the bounded implementation and verification slice for the current release-ready state.",
    "Keep the slice reversible and owned by the $build lane.",
  ];
}

function createBuildVerificationPlan(nextTrigger = "$build") {
  return [
    "Confirm release gates and runtime control-plane artifacts are still green.",
    `Use ${nextTrigger} as the bounded verification loop trigger for the current build slice.`,
  ];
}

function createBuildRepairPath() {
  return [
    "If the bounded build slice becomes invalid without upstream gate regression, return to READY and rerun `$build`.",
    "If runtime or upstream gates regress, fail closed and repair those blockers before resuming.",
  ];
}

async function updateMaestroLedgerForBuild({
  buildStatus,
  runtimeSummary,
  blockers,
  nextTriggers,
  gateState,
  trackStatus,
  completionEvidence = [],
}) {
  let maestroState = await loadMaestroStateOrDefault();
  maestroState = beginMaestroOrchestration(maestroState, {
    globalStatus: gateState,
  });
  maestroState.runtime_tracks.track_0_sync = {
    active_gate: "$build",
    status: trackStatus,
    pid: null,
    execution_pane: null,
    exit_code: trackStatus === "COMPLETED" ? 0 : null,
    blockers,
    next_triggers: nextTriggers,
    completion_evidence: completionEvidence,
    build_status: buildStatus,
    updated_at: new Date().toISOString(),
    runtime_summary: {
      pendingMailboxCount: runtimeSummary.pendingMailboxCount,
      invalidArtifacts: runtimeSummary.invalidArtifacts,
      missingArtifacts: runtimeSummary.missingArtifacts,
    },
  };
  maestroState.downstream_lock_table.$build = {
    is_locked: buildStatus !== "DONE",
    locked_by: buildStatus === "DONE" ? [] : ["$build"],
    unlock_criteria: "build_status == 'DONE'",
  };
  maestroState.timestamp = new Date().toISOString();
  maestroState.global_status = gateState;
  await saveMaestroState(maestroState);
  await appendMaestroEvent({
    record_type: "runtime:track_status",
    gate: "$build",
    global_status: gateState,
    track_status: trackStatus,
    build_status: buildStatus,
    next_triggers: nextTriggers,
    blockers,
  });
  await appendMaestroEvent({
    record_type: "lock:downstream_circuit_breaker",
    target_gate: "$build",
    is_locked: buildStatus !== "DONE",
    locked_by: buildStatus === "DONE" ? [] : ["$build"],
    unlock_criteria: "build_status == 'DONE'",
  });
}

async function updateScratchpadTrackForLane({
  gate,
  trackStatus,
  globalStatus,
  blockers = [],
  nextTriggers = [],
  detached = null,
  details = {},
}) {
  let maestroState = await loadMaestroStateOrDefault();
  maestroState = beginMaestroOrchestration(maestroState, {
    globalStatus,
  });
  const trackKey = `track_${gate.replaceAll("$", "")}_sync`;
  maestroState.runtime_tracks[trackKey] = {
    active_gate: gate,
    status: trackStatus,
    pid: null,
    execution_pane: detached?.executionPane ?? null,
    provider: detached?.provider ?? "none",
    log_path: detached?.logPath ?? null,
    exit_code: trackStatus === "COMPLETED" ? 0 : null,
    blockers,
    next_triggers: nextTriggers,
    updated_at: new Date().toISOString(),
    ...details,
  };
  maestroState.timestamp = new Date().toISOString();
  maestroState.global_status = globalStatus;
  await saveMaestroState(maestroState);
  await appendMaestroEvent({
    record_type: "runtime:track_status",
    gate,
    global_status: globalStatus,
    track_status: trackStatus,
    next_triggers: nextTriggers,
    blockers,
    provider: detached?.provider ?? "none",
  });
}

export async function runBuildLane({ actor = null, reviewMode = null, quorumVotes = [] } = {}) {
  const authority = await assertLeaderAuthority(actor);
  const runtimeSnapshot = await loadRuntimeSnapshot();
  const runtimeSummary = createRuntimeSummary(runtimeSnapshot);
  const evaluation = evaluateRuntimeBuildReadiness(runtimeSnapshot.release, runtimeSummary);

  if (evaluation.controlPlaneBlockers.length > 0) {
    throw new Error(`Invalid runtime artifacts: ${evaluation.controlPlaneBlockers.join(", ")}`);
  }

  if (!evaluation.allowed) {
    await writeBuildPlanArtifact({
      allowed: false,
      gateState: "LOCKED",
      blockers: evaluation.blockers,
      nextTriggers: evaluation.nextTriggers,
      buildSlice: createBoundedBuildSlice(),
      verificationPlan: createBuildVerificationPlan("`$build`"),
      repairPath: createBuildRepairPath(),
      runtimeSummary,
    });
    await updateMaestroLedgerForBuild({
      buildStatus: runtimeSnapshot.release.build_status,
      runtimeSummary,
      blockers: evaluation.blockers,
      nextTriggers: evaluation.nextTriggers,
      gateState: "LOCKED",
      trackStatus: "BLOCKED",
    });
    await appendDecision({
      actor: authority.leaderActor,
      kind: "skill",
      skill: "$build",
      decision: "Build execution remains locked under the current runtime and release state.",
      status: "BLOCKED",
      evidence: [{ kind: "runtime-summary", value: runtimeSummary }],
      blockers: evaluation.blockers,
      next_allowed_triggers: evaluation.nextTriggers,
    });
    return {
      status: "BLOCKED",
      nextTrigger: evaluation.nextTriggers[0] ?? "$build",
      blockers: evaluation.blockers,
    };
  }

  const suggestedBranches = ["feature/implementation", "feature/verification"];
  const buildSlice = createBoundedBuildSlice();
  const verificationPlan = createBuildVerificationPlan("`$build`");
  const repairPath = createBuildRepairPath();
  const ralphContract = await writeRalphExecutionContract({
    buildSlice,
    verificationPlan,
    runtimeSummary,
  });

  if (runtimeSnapshot.release.build_status === "LOCKED") {
    await writeBuildPlanArtifact({
      allowed: true,
      gateState: "READY",
      blockers: [],
      nextTriggers: ["$build"],
      suggestedBranches,
      buildSlice,
      verificationPlan,
      repairPath,
      runtimeSummary,
    });
    await appendDecision({
      actor: authority.leaderActor,
      kind: "skill",
      skill: "$build",
      decision: "Build gate ready",
      status: "READY",
      evidence: [
        { kind: "runtime-summary", value: runtimeSummary },
        { kind: "branches", value: suggestedBranches },
        { kind: "build-slice", value: buildSlice },
        { kind: "ralph-prd", value: ralphContract.prdPath },
      ],
      blockers: [],
      next_allowed_triggers: ["$build"],
    });
    await syncStatusUpdates({ build_status: "READY" }, { actor: authority.leaderActor });
    await updateMaestroLedgerForBuild({
      buildStatus: "READY",
      runtimeSummary,
      blockers: [],
      nextTriggers: ["$build"],
      gateState: "READY",
      trackStatus: "READY",
    });
    return {
      status: "READY",
      nextTrigger: "$build",
      blockers: [],
      suggestedBranches,
    };
  }

  if (runtimeSnapshot.release.build_status === "READY") {
    await writeBuildPlanArtifact({
      allowed: true,
      gateState: "RUNNING",
      blockers: [],
      nextTriggers: ["$build"],
      suggestedBranches,
      buildSlice,
      verificationPlan,
      repairPath,
      runtimeSummary,
    });
    await appendDecision({
      actor: authority.leaderActor,
      kind: "skill",
      skill: "$build",
      decision: "Started the bounded build execution substep",
      status: "RUNNING",
      evidence: [
        { kind: "runtime-summary", value: runtimeSummary },
        { kind: "build-slice", value: buildSlice },
        { kind: "verification-plan", value: verificationPlan },
        { kind: "ralph-prd", value: ralphContract.prdPath },
      ],
      blockers: [],
      next_allowed_triggers: ["$build"],
    });
    await syncStatusUpdates({ build_status: "RUNNING" }, { actor: authority.leaderActor });
    await updateMaestroLedgerForBuild({
      buildStatus: "RUNNING",
      runtimeSummary,
      blockers: [],
      nextTriggers: ["$build"],
      gateState: "RUNNING",
      trackStatus: "RUNNING",
    });
    return {
      status: "RUNNING",
      nextTrigger: "$build",
      blockers: [],
      suggestedBranches,
    };
  }

  const completionEvidence = [
    "Build slice remained release-ready through the bounded verification substep.",
    "Runtime control-plane artifacts remained valid at completion.",
  ];
  if (reviewMode === "quorum") {
    const quorum = evaluateQuorumVotes(quorumVotes);
    const quorumReceipt = createQuorumReviewReceipt({ votes: quorumVotes, evaluation: quorum });
    if (quorum.decision !== quorumDecisions.APPROVED) {
      await writeBuildPlanArtifact({
        allowed: true,
        gateState: "READY",
        blockers: quorum.blockers,
        nextTriggers: ["$build"],
        suggestedBranches,
        buildSlice,
        verificationPlan: [
          ...verificationPlan,
          "Resolve quorum disagreement or provide a compatible majority fingerprint before promotion.",
        ],
        repairPath,
        runtimeSummary,
      });
      await appendDecision({
        actor: authority.leaderActor,
        kind: "skill",
        skill: "$build",
        decision: "Quorum review did not approve the current bounded build slice",
        status: "READY",
        evidence: [
          { kind: "runtime-summary", value: runtimeSummary },
          { kind: "quorum-votes", value: quorumVotes },
          { kind: "quorum-decision", value: quorum },
          { kind: "quorum-receipt", value: quorumReceipt },
          { kind: "ralph-prd", value: ralphContract.prdPath },
        ],
        blockers: quorum.blockers,
        next_allowed_triggers: ["$build"],
      });
      await syncStatusUpdates({ build_status: "READY" }, { actor: authority.leaderActor });
      await updateMaestroLedgerForBuild({
        buildStatus: "READY",
        runtimeSummary,
        blockers: quorum.blockers,
        nextTriggers: ["$build"],
        gateState: "READY",
        trackStatus: "BLOCKED",
        completionEvidence: ["Quorum review returned INDETERMINATE or non-approval."],
      });
      return {
        status: "READY",
        nextTrigger: "$build",
        blockers: quorum.blockers,
        suggestedBranches,
      };
    }
    completionEvidence.push(
      "Quorum review approved the bounded build slice with a majority-compatible fingerprint.",
    );
    completionEvidence.push(
      `Quorum confidence receipt recorded with ${quorumReceipt.reviewer_count} reviewers.`,
    );
  }
  await writeBuildPlanArtifact({
    allowed: true,
    gateState: "DONE",
    blockers: [],
    nextTriggers: ["ma merge <feature/*> development"],
    suggestedBranches,
    buildSlice,
    verificationPlan,
    repairPath,
    completionEvidence,
    runtimeSummary,
  });
  await appendDecision({
    actor: authority.leaderActor,
    kind: "skill",
    skill: "$build",
    decision: "Completed the bounded build execution substep",
    status: "DONE",
    evidence: [
      { kind: "runtime-summary", value: runtimeSummary },
      { kind: "branches", value: suggestedBranches },
      { kind: "completion-evidence", value: completionEvidence },
      { kind: "ralph-prd", value: ralphContract.prdPath },
    ],
    blockers: [],
    next_allowed_triggers: ["ma merge <feature/*> development"],
  });
  await syncStatusUpdates({ build_status: "DONE" }, { actor: authority.leaderActor });
  await updateMaestroLedgerForBuild({
    buildStatus: "DONE",
    runtimeSummary,
    blockers: [],
    nextTriggers: ["ma merge <feature/*> development"],
    gateState: "COMPLETED",
    trackStatus: "COMPLETED",
    completionEvidence,
  });
  return {
    status: "DONE",
    nextTrigger: "ma merge <feature/*> development",
    blockers: [],
    suggestedBranches,
  };
}

function getAutonomousGateRunners() {
  return {
    $arch: runArch,
    $sage: runSage,
    $flow: runFlow,
    $vet: runVet,
    $vibe: runVibe,
    $build: runBuildLane,
  };
}

function updateManagerRunTimestamps(managerRun, overrides = {}) {
  const now = new Date().toISOString();
  Object.assign(managerRun, overrides, { updatedAt: now });
  if (["completed", "blocked", "failed", "cancelled"].includes(managerRun.state)) {
    managerRun.completedAt ??= now;
  }
}

function buildManagerDecisionEvidence(managerRun, recommendation) {
  return [
    {
      runId: managerRun.id,
      mode: managerRun.mode,
      state: managerRun.state,
      nextAction: managerRun.nextAction,
      helperRuns: managerRun.helperRuns.map((helper) => ({
        id: helper.id,
        skill: helper.skill,
        status: helper.status,
        objective: helper.objective,
      })),
      dispatchPlan: {
        helpers: managerRun.dispatchPlan.helpers.map((helper) => ({
          skill: helper.skill,
          objective: helper.objective,
        })),
        gated: managerRun.dispatchPlan.gated.map((gate) => ({
          skill: gate.skill,
          objective: gate.objective,
          status: gate.status,
        })),
        team: managerRun.dispatchPlan.team
          ? {
              title: managerRun.dispatchPlan.team.title,
              createdTaskIds: managerRun.dispatchPlan.team.createdTaskIds,
            }
          : null,
      },
    },
    recommendation,
  ];
}

function buildManagerDecisionBlockers(managerRun, runtimeSummary, buildReadiness) {
  const blockers = [];
  if (managerRun.state === "waiting-review" && managerRun.pendingReview.proposalPath) {
    blockers.push(`Manager run is waiting for review at ${managerRun.pendingReview.proposalPath}.`);
  }
  if (managerRun.state === "blocked" && managerRun.retry.lastReason) {
    blockers.push(managerRun.retry.lastReason);
  }
  if (
    buildReadiness &&
    !buildReadiness.allowed &&
    buildReadiness.nextTriggers.includes("repair runtime artifacts")
  ) {
    blockers.push(...buildReadiness.runtimeBlockers);
  }
  if (runtimeSummary.pendingMailboxCount > 0) {
    blockers.push("Pending mailbox proposals require leader review.");
  }

  return [...new Set(blockers)];
}

function executeManagerHelper(helper, { releaseState, runtimeSummary, recommendation }) {
  const baseReceipt = ({ observedContext, result, nextTrigger }) => ({
    helperId: helper.id,
    ...createHelperReceipt({
      skill: helper.skill,
      objective: helper.objective,
      observedContext,
      result,
      nextTrigger: nextTrigger ?? recommendation.nextTrigger ?? "$maestro",
    }),
  });

  if (helper.skill === "$align") {
    return {
      ...baseReceipt({
        observedContext: `build_status=${releaseState.build_status}; next=${recommendation.nextTrigger}`,
        result: "Normalized the manager handoff around the current lane sequence and next trigger.",
      }),
      workflowSequence: maestroWorkflowSequence,
      currentBuildStatus: releaseState.build_status,
      recommendedNextTrigger: recommendation.nextTrigger,
    };
  }

  if (helper.skill === "$diagnose") {
    return {
      ...baseReceipt({
        observedContext: `pending_mailbox=${runtimeSummary.pendingMailboxCount}; invalid_artifacts=${runtimeSummary.invalidArtifacts.length}; missing_artifacts=${runtimeSummary.missingArtifacts.length}`,
        result: "Captured the smallest blocker slices before the manager resumes gated work.",
      }),
      pendingMailboxCount: runtimeSummary.pendingMailboxCount,
      invalidArtifacts: runtimeSummary.invalidArtifacts,
      missingArtifacts: runtimeSummary.missingArtifacts,
    };
  }

  if (helper.skill === "$tdd") {
    return {
      ...baseReceipt({
        observedContext: `build_status=${releaseState.build_status}; next=${recommendation.nextTrigger}`,
        result: "Defined the regression-first boundary for the owning implementation lane.",
      }),
      buildStatus: releaseState.build_status,
      nextTrigger: recommendation.nextTrigger,
    };
  }

  if (helper.skill === "$cleanup") {
    return {
      ...baseReceipt({
        observedContext: `merge_status=${releaseState.merge_status}; release_status=${releaseState.release_status}`,
        result: "Prepared contract-preserving simplification without changing release authority.",
      }),
      mergeStatus: releaseState.merge_status,
      releaseStatus: releaseState.release_status,
    };
  }

  return {
    helperId: helper.id,
    kind: "manager-helper",
    objective: helper.objective,
  };
}

async function executeManagerHelpers({
  registry,
  managerRun,
  releaseState,
  runtimeSummary,
  recommendation,
  helperFailureMatrix,
}) {
  const startedAt = new Date().toISOString();
  updateManagerRunTimestamps(managerRun, { state: "running" });
  for (const helperRun of managerRun.helperRuns) {
    helperRun.status = "running";
    helperRun.startedAt = startedAt;
  }
  await saveManagerRunRegistry(registry);

  const results = await Promise.allSettled(
    managerRun.helperRuns.map(async (helperRun) => {
      const evidence = executeManagerHelper(helperRun, {
        releaseState,
        runtimeSummary,
        recommendation,
      });
      return { helperRun, evidence };
    }),
  );

  const continuedHelpers = [];
  let hadFailure = false;
  for (const result of results) {
    const helperRun =
      result.status === "fulfilled"
        ? result.value.helperRun
        : managerRun.helperRuns[results.indexOf(result)];

    if (result.status === "fulfilled") {
      helperRun.status = "completed";
      helperRun.evidence.push(result.value.evidence);
      helperRun.completedAt = new Date().toISOString();
      continuedHelpers.push(helperRun.skill);
      continue;
    }

    hadFailure = true;
    const policy = helperFailureMatrix.helper_failed_but_manager_can_fall_back_to_safe_summary;
    helperRun.status = "failed";
    helperRun.errorClass = "helper_failed_but_manager_can_fall_back_to_safe_summary";
    helperRun.errorMessage = result.reason?.message ?? String(result.reason);
    helperRun.completedAt = new Date().toISOString();
    helperRun.evidence.push({
      runId: managerRun.id,
      helperId: helperRun.id,
      skill: helperRun.skill,
      objective: helperRun.objective,
      degradedReason: helperRun.errorMessage,
      safeNextTrigger: recommendation.nextTrigger,
      siblingHelperPolicy: policy.siblingHelperPolicy,
      continuedHelpers,
    });
  }

  if (hadFailure) {
    updateManagerRunTimestamps(managerRun, {
      state: "completed",
      retry: {
        count: managerRun.retry.count + 1,
        lastReason: "One or more helper runs degraded to recommendation-only behavior.",
      },
    });
    await saveManagerRunRegistry(registry);
    return false;
  }

  await saveManagerRunRegistry(registry);
  return true;
}

async function executeManagerTeamDispatch(registry, managerRun) {
  const teamPlan = managerRun.dispatchPlan.team;
  if (!teamPlan) {
    return;
  }

  const taskResult = await submitTask({
    title: teamPlan.title,
    owner: "leader",
    metadata: {
      classification: "durable-team-task",
      managerOwner: "$maestro",
      managerRunId: managerRun.id,
      objective: teamPlan.objective,
      verificationOwner: teamPlan.verificationOwner,
      launchHints: teamPlan.launchHints,
      staffing: teamPlan.staffing,
    },
  });

  if (taskResult.proposed) {
    updateManagerRunTimestamps(managerRun, {
      state: "waiting-review",
      pendingReview: {
        proposalPath: taskResult.proposalPath,
        mailboxOwner: "leader",
        resumeTrigger: "Review the queued team task proposal, then rerun `$maestro`.",
      },
    });
    await saveManagerRunRegistry(registry);
    return;
  }

  teamPlan.createdTaskIds.push(taskResult.task.id);
  updateManagerRunTimestamps(managerRun, { state: "running" });
  await saveManagerRunRegistry(registry);
}

export async function runIdea(idea) {
  const runtimeSummary = await readRuntimeSummary();
  assertControlPlaneReady(runtimeSummary);
  await assertLeaderAuthority();
  const trimmed = idea.trim();
  if (!trimmed) {
    throw new Error("Idea text is required");
  }

  await writeProjectContext(trimmed);

  await appendDecision({
    kind: "idea",
    idea: trimmed,
    decision: "Captured project idea",
    status: "CLEAR",
    evidence: [{ kind: "user-input", value: trimmed }],
    blockers: [],
    next_allowed_triggers: ["$maestro"],
  });

  await syncStatusUpdates({ idea_status: "CLEAR" });
}

export async function runArch() {
  await assertLeaderAuthority();
  const runtimeSummary = await readRuntimeSummary();
  assertControlPlaneReady(runtimeSummary);
  const idea = await readIdeaText();
  if (!idea) {
    throw new Error("Cannot run $arch before ma idea captures a project brief");
  }

  const blueprint = {
    decision: "Approve the first bounded architecture direction.",
    status: "APPROVED",
    summary: `Blueprint derived from idea: ${idea}. Runtime shell currently exposes ${runtimeSummary.workerCount} workers, ${runtimeSummary.workspaceCount} workspaces, and ${runtimeSummary.guidanceSourceCount} guidance sources.`,
    suggestedStack: ["Node.js", "MCP", "GitMCP", "Git worktree", "File-backed runtime state"],
    workloadAssumptions: [
      "single-repo operator workflow",
      "gate-driven release discipline",
      "file-backed runtime state",
    ],
    rejectedAlternatives: [
      "Standalone second umbrella runtime surface because it would weaken Meta-Architect ownership.",
    ],
    evidence: [
      `Workers detected: ${runtimeSummary.workerCount}`,
      `Workspaces detected: ${runtimeSummary.workspaceCount}`,
      `Guidance sources detected: ${runtimeSummary.guidanceSourceCount}`,
    ],
    blockers: [],
    nextAllowedTriggers: ["`$sage`"],
    outcome: "Produce a gated architecture and implementation plan backed by runtime state.",
  };

  await writeArchitectureArtifacts({ idea, blueprint, runtimeSummary });

  await appendDecision({
    kind: "skill",
    skill: "$arch",
    decision: "Generated architecture blueprint",
    status: "APPROVED",
    evidence: [blueprint],
    blockers: [],
    next_allowed_triggers: ["$sage"],
  });

  await syncStatusUpdates({ architecture_status: "APPROVED" });
  await updateScratchpadTrackForLane({
    gate: "$arch",
    trackStatus: "COMPLETED",
    globalStatus: "COMPLETED",
    nextTriggers: ["$sage"],
    details: {
      decision: blueprint.decision,
      rejected_alternatives: blueprint.rejectedAlternatives,
    },
  });
}

export async function runSage() {
  await assertLeaderAuthority();
  const config = await validateMcpServers();
  const runtimeSummary = await readRuntimeSummary();
  assertControlPlaneReady(runtimeSummary);
  await seedRedactionVault();
  const disableLiveProbe = process.env.MA_DISABLE_LIVE_MCP === "1";
  const sourceEntries = config.servers.map((server) => ({
    repo: server.repo,
    endpoint: server.endpoint,
    category: server.category,
    exactUpstreamMapping: server.repo,
    evidenceGrade: disableLiveProbe ? "PARTIAL" : "MISSING",
  }));
  const blockers = [];
  const idea = (await readIdeaText()) ?? "software architecture";
  let verificationSuccessCount = 0;
  let coreSourceIngest = null;
  try {
    coreSourceIngest = await loadCoreSourceIngest();
  } catch {
    coreSourceIngest = null;
  }

  for (const source of sourceEntries) {
    const ingestedSource = findIngestedCoreSourceForRepo(coreSourceIngest, source.repo);
    if (ingestedSource) {
      source.localSourceSnapshot = {
        status: ingestedSource.status,
        localPath: ingestedSource.local_path,
        capability: ingestedSource.capability,
        semanticRole: ingestedSource.semantic_role,
        fileCount: ingestedSource.file_count,
        contentSha256: ingestedSource.content_sha256,
        gitCommit: ingestedSource.git_commit,
        sampledFiles: ingestedSource.sampled_files,
      };
      source.liveProbe = {
        transport: "local-core-source-ingest",
        queryMode: "local-snapshot",
        sampleText: ingestedSource.sample_text?.slice(0, 400) ?? null,
      };
      source.evidenceGrade = "VERIFIED";
      verificationSuccessCount += 1;
      continue;
    }

    if (disableLiveProbe) {
      source.liveProbe = {
        skipped: true,
        reason: "MA_DISABLE_LIVE_MCP=1",
      };
      continue;
    }

    const client = createMcpLiveClient(source.endpoint);
    try {
      const init = await client.connect();
      const tools = await client.request("tools/list", {});
      const searchTool = tools.tools?.find((tool) => isGitMcpDocumentationTool(tool, "search"));
      const fetchTool = tools.tools?.find((tool) => isGitMcpDocumentationTool(tool, "fetch"));

      let evidence = null;
      let queryMode = "list-only";
      const callFailures = [];
      if (fetchTool) {
        try {
          evidence = await client.request("tools/call", {
            name: fetchTool.name,
            arguments: {},
          });
          queryMode = "fetch";
        } catch (error) {
          callFailures.push({
            tool: fetchTool.name,
            error: error.message,
          });
        }
      }
      if (!evidence && searchTool) {
        const redactedQuery = await redactProviderBoundText(idea, {
          kind: "sage-live-query",
          repo: source.repo,
        });
        try {
          evidence = await client.request("tools/call", {
            name: searchTool.name,
            arguments: { query: redactedQuery.sanitizedText },
          });
          queryMode = "search";
        } catch (error) {
          callFailures.push({
            tool: searchTool.name,
            error: error.message,
          });
        }
      }
      if ((fetchTool || searchTool) && !evidence) {
        throw new Error(
          `No GitMCP documentation call succeeded: ${callFailures
            .map((failure) => `${failure.tool}: ${failure.error}`)
            .join("; ")}`,
        );
      }

      source.liveProbe = {
        transport: hasConfiguredMcpRemoteBridge() ? "stdio-bridge" : "direct-sse",
        serverName: init.serverInfo?.name ?? "unknown",
        serverVersion: init.serverInfo?.version ?? "unknown",
        toolsCount: tools.tools?.length ?? 0,
        queryMode,
        callFailures,
        sampleText:
          evidence?.content?.find((item) => item.type === "text")?.text?.slice(0, 400) ?? null,
      };
      source.evidenceGrade = "VERIFIED";
      source.exactUpstreamMapping = source.repo;
      verificationSuccessCount += 1;
    } catch (error) {
      source.liveProbe = {
        transport: hasConfiguredMcpRemoteBridge() ? "stdio-bridge" : "direct-sse",
        error: error.message,
      };
      source.evidenceGrade = "PARTIAL";
      source.exactUpstreamMapping = source.repo;
      blockers.push(`Live MCP query failed for ${source.repo}: ${error.message}`);
    } finally {
      await client.close().catch(() => {});
    }
  }

  const existing = await readJson(getRuntimeWritePath("evidence", "sources.json"));
  existing.items = sourceEntries;
  await writeJson(getRuntimeWritePath("evidence", "sources.json"), existing);

  const verified = sourceEntries.length > 0 && verificationSuccessCount === sourceEntries.length;
  if (sourceEntries.length > 0 && !verified && blockers.length === 0) {
    blockers.push(
      disableLiveProbe
        ? "Live MCP verification was skipped, so evidence remains unverified."
        : "No live MCP verification succeeded, so evidence remains unverified.",
    );
  }
  await writeEvidenceSpec({ idea, sourceEntries, verified, blockers, runtimeSummary });
  await appendDecision({
    kind: "skill",
    skill: "$sage",
    decision:
      "Bound architectural choices to approved sources using local core-source snapshots first, with GitMCP only as refresh/provenance fallback",
    status: verified ? "VERIFIED" : sourceEntries.length > 0 ? "PARTIAL" : "MISSING",
    evidence: sourceEntries,
    blockers: sourceEntries.length > 0 ? blockers : ["No approved GitMCP sources configured"],
    next_allowed_triggers: verified ? ["$flow"] : ["mcp/servers.json", "$sage"],
  });

  await syncStatusUpdates({
    evidence_status: verified ? "VERIFIED" : sourceEntries.length > 0 ? "PARTIAL" : "MISSING",
  });
  await updateScratchpadTrackForLane({
    gate: "$sage",
    trackStatus: verified ? "COMPLETED" : "BLOCKED",
    globalStatus: verified ? "COMPLETED" : "LOCKED",
    blockers: sourceEntries.length > 0 ? blockers : ["No approved GitMCP sources configured"],
    nextTriggers: verified ? ["$flow"] : ["$sage"],
    details: {
      evidence_grade: verified ? "VERIFIED" : sourceEntries.length > 0 ? "PARTIAL" : "MISSING",
      exact_upstream_mapping: sourceEntries.map((source) => source.repo),
    },
  });
}

export async function runFlow() {
  await assertLeaderAuthority();
  const runtimeSnapshot = await loadRuntimeSnapshot();
  const runtimeSummary = createRuntimeSummary(runtimeSnapshot);
  assertControlPlaneReady(runtimeSummary);
  if (runtimeSnapshot.release.evidence_status !== "VERIFIED") {
    throw new Error("Cannot run $flow before $sage reaches VERIFIED evidence_status");
  }
  const blockers = [];
  if (runtimeSummary.missingArtifacts.length > 0) {
    blockers.push(`Missing runtime artifacts: ${runtimeSummary.missingArtifacts.join(", ")}`);
  }
  if (runtimeSummary.invalidArtifacts.length > 0) {
    blockers.push(`Invalid runtime artifacts: ${runtimeSummary.invalidArtifacts.join(", ")}`);
  }
  if (runtimeSummary.pendingMailboxCount > 0) {
    blockers.push(
      "Pending mailbox proposals require leader review before logic can be marked green.",
    );
  }
  if (runtimeSummary.workerCount > 0 && runtimeSummary.workspaceCount === 0) {
    blockers.push("Workers exist without registered workspaces.");
  }
  const actors = ["leader", "worker", "guidance_stack", "hook_dispatcher", "workspace_manager"];
  const logicMap = {
    actors,
    decision:
      blockers.length === 0
        ? "Approve the current behavioral model for downstream review."
        : "Behavioral model remains blocked until the identified logic/runtime issues are resolved.",
    status: blockers.length === 0 ? "GREEN" : "RED",
    states: ["idea", "architecture", "evidence", "logic", "security", "experience", "build"],
    stateMap: [
      "idea -> architecture -> evidence -> logic -> security -> experience -> build",
      "logic review must stop if runtime artifacts are invalid or worker/workspace integrity breaks",
    ],
    failureFlows:
      blockers.length > 0
        ? blockers
        : ["No blocking failure flow detected in the current runtime snapshot."],
    evidence: [
      `actors observed: ${actors.length}`,
      `pending mailbox proposals: ${runtimeSummary.pendingMailboxCount}`,
      `registered workspaces: ${runtimeSummary.workspaceCount}`,
    ],
    runtimeSummary,
    blockers,
    nextTrigger: blockers.length === 0 ? "`$vet`" : "`$flow`",
    nextAllowedTriggers: blockers.length === 0 ? ["`$vet`"] : ["`$flow`"],
  };
  const status = blockers.length === 0 ? "GREEN" : "RED";
  const nextAllowedTriggers = blockers.length === 0 ? ["$vet"] : ["$flow"];

  await writeLogicSpec(logicMap);

  await appendDecision({
    kind: "skill",
    skill: "$flow",
    decision: "Validated logic and state transitions",
    status,
    evidence: [logicMap],
    blockers,
    next_allowed_triggers: nextAllowedTriggers,
  });

  await syncStatusUpdates({ logic_status: status });
  await updateScratchpadTrackForLane({
    gate: "$flow",
    trackStatus: status === "GREEN" ? "COMPLETED" : "BLOCKED",
    globalStatus: status === "GREEN" ? "COMPLETED" : "LOCKED",
    blockers,
    nextTriggers: nextAllowedTriggers,
    details: {
      failure_flows: logicMap.failureFlows,
      state_map: logicMap.stateMap,
      hardening_mode: runtimeSummary.pendingMailboxCount > 0 ? "STRICT" : "STANDARD",
    },
  });
}

export async function runVet() {
  await assertLeaderAuthority();
  const runtimeSummary = await readRuntimeSummary();
  assertControlPlaneReady(runtimeSummary);
  const auditLog = await readJson(getRuntimeWritePath("evidence", "audits.json"));
  const cveLog = await readJson(getRuntimeWritePath("evidence", "cves.json"));
  const packageExposureFindings = await scanLockfilePackageExposure();
  const policyFindings = await validateMcpPolicyExposure();
  const criticalPackageExposure = packageExposureFindings.filter(
    (finding) => finding.severity === "critical",
  );
  const blockingPolicyFindings = policyFindings.filter((finding) =>
    ["critical", "high"].includes(`${finding.severity}`.toLowerCase()),
  );
  const reviewApproved =
    auditLog.items.some((item) => item.source === "review" || item.approved === true) ||
    cveLog.items.some((item) => item.source === "review" || item.approved === true);
  const scanApproved = criticalPackageExposure.length === 0 && blockingPolicyFindings.length === 0;
  const finding =
    criticalPackageExposure.length > 0
      ? {
          severity: criticalPackageExposure[0].severity.toUpperCase(),
          source: "package-exposure-scan",
          summary: criticalPackageExposure
            .map(
              (item) =>
                `${item.package_name}@${item.package_version}: ${item.diagnostic} (${item.advisory_reference})`,
            )
            .join(" "),
          unresolved: true,
          trustBoundaries: [
            "lockfile metadata vs provider-bound or build-unlocking execution",
            "repo-owned MCP config vs runtime-local scratchpad state",
            "published docs vs private `.ma` execution state",
          ],
          acceptedRisks: ["No accepted risk: blocking package exposure must be remediated."],
        }
      : {
          severity: policyFindings.length > 0 ? "WARNING" : "INFO",
          source: policyFindings.length > 0 ? "mcp-policy-validation" : "runtime-review",
          summary:
            policyFindings.length > 0
              ? policyFindings.map((item) => item.diagnostic).join(" ")
              : `No blocking package exposure was detected in the current bounded scan. Review still remains required after checking ${runtimeSummary.compatibilityHookCount} compatibility hooks and ${runtimeSummary.runtimeHookCount} runtime events.`,
          unresolved: !reviewApproved && !scanApproved,
          trustBoundaries: [
            "leader vs worker mutation authority",
            "repo-owned MCP config vs runtime-local scratchpad state",
            "published docs vs private `.ma` execution state",
          ],
          acceptedRisks: scanApproved
            ? ["No material unresolved risk remains for the current bounded step."]
            : [
                "Security evidence still requires explicit approval or remediation before promotion.",
              ],
        };
  auditLog.items.push(finding, ...packageExposureFindings, ...policyFindings);
  await writeJson(getRuntimeWritePath("evidence", "audits.json"), auditLog);
  cveLog.items.push(
    ...packageExposureFindings.map((item) => ({
      id: item.advisory_reference ?? `${item.package_name}-${item.package_version}`,
      source: "package-exposure-scan",
      severity: item.severity.toUpperCase(),
      unresolved: true,
      package_name: item.package_name,
      package_version: item.package_version,
    })),
    {
      id: "baseline-review",
      source: packageExposureFindings.length > 0 ? "package-exposure-scan" : "runtime-review",
      severity: packageExposureFindings.length > 0 ? "CRITICAL" : "INFO",
      unresolved: !reviewApproved && !scanApproved,
    },
  );
  await writeJson(getRuntimeWritePath("evidence", "cves.json"), cveLog);
  for (const exposureFinding of packageExposureFindings) {
    await appendMaestroEvent(exposureFinding);
  }
  for (const policyFinding of policyFindings) {
    await appendMaestroEvent(policyFinding);
  }
  await writeSecuritySpec({
    finding,
    auditCount: auditLog.items.length,
    cveCount: cveLog.items.length,
    runtimeSummary,
    nextTrigger: scanApproved ? "`$vibe`" : "`$vet`",
  });
  const status = scanApproved ? "GREEN" : criticalPackageExposure.length > 0 ? "RED" : "PENDING";
  const blockers =
    criticalPackageExposure.length > 0
      ? criticalPackageExposure.map(
          (item) =>
            `${item.package_name}@${item.package_version}: ${item.diagnostic} (${item.advisory_reference})`,
        )
      : reviewApproved
        ? []
        : blockingPolicyFindings.map((finding) => finding.diagnostic);
  const nextAllowedTriggers = scanApproved
    ? ["$vibe"]
    : criticalPackageExposure.length > 0
      ? ["$vet"]
      : ["$vet"];

  await appendDecision({
    kind: "skill",
    skill: "$vet",
    decision: "Reviewed security posture for the current implementation",
    status,
    evidence: [finding],
    blockers,
    next_allowed_triggers: nextAllowedTriggers,
  });

  await syncStatusUpdates({ security_status: status });
  await updateScratchpadTrackForLane({
    gate: "$vet",
    trackStatus: status === "GREEN" ? "COMPLETED" : "BLOCKED",
    globalStatus:
      status === "GREEN" ? "COMPLETED" : status === "RED" ? "LOCKED" : "DEGRADED_HEALING",
    blockers,
    nextTriggers: nextAllowedTriggers,
    details: {
      trust_boundaries: finding.trustBoundaries,
      accepted_risks: finding.acceptedRisks,
      healing_ledger: reviewApproved
        ? null
        : {
            current_attempt: 0,
            strategy_assigned: "BOUNDED_DIAGNOSTIC_REVIEW",
            status: "PENDING_OPERATOR_APPROVAL",
          },
    },
  });
}

export async function runVibe() {
  await assertLeaderAuthority();
  const runtimeSummary = await readRuntimeSummary();
  assertControlPlaneReady(runtimeSummary);
  const outcomes = await readJson(getRuntimeWritePath("evidence", "outcomes.json"));
  const reviewApproved = outcomes.items.some(
    (item) =>
      ["review", "vibe-review", "dx-ux-review"].includes(item.source) && item.approved === true,
  );
  const automatedReviewChecks = [
    {
      name: "no_pending_mailbox_proposals",
      passed: runtimeSummary.pendingMailboxCount === 0,
      evidence: `${runtimeSummary.pendingMailboxCount} pending mailbox proposals`,
    },
    {
      name: "runtime_artifacts_valid",
      passed: runtimeSummary.invalidArtifacts.length === 0,
      evidence: `${runtimeSummary.invalidArtifacts.length} invalid runtime artifacts`,
    },
    {
      name: "runtime_artifacts_present",
      passed: runtimeSummary.missingArtifacts.length === 0,
      evidence: `${runtimeSummary.missingArtifacts.length} missing runtime artifacts`,
    },
    {
      name: "workspace_context_available",
      passed: runtimeSummary.workspaceCount > 0,
      evidence: `${runtimeSummary.workspaceCount} workspace context entries`,
    },
  ];
  const runtimeApproved = automatedReviewChecks.every((check) => check.passed);
  const failedAutomatedReviewChecks = automatedReviewChecks
    .filter((check) => !check.passed)
    .map((check) => `${check.name}: ${check.evidence}`);
  const note = {
    area: "developer-experience",
    source: "runtime-vibe-review",
    summary: `Runtime DX/UX review recorded from current coordination state: ${runtimeSummary.taskCount} tasks, ${runtimeSummary.workspaceCount} workspaces, and ${runtimeSummary.pendingMailboxCount} pending mailbox proposals.`,
    automatedReviewChecks,
    operatorFriction: [
      runtimeSummary.pendingMailboxCount > 0
        ? "Pending mailbox proposals increase operator coordination overhead."
        : "Operator flow is bounded and clear in the current runtime state.",
    ],
    userFriction: [
      "The gated sequence is explicit, but users still need clearer build-loop feedback once execution starts.",
    ],
    approved: reviewApproved || runtimeApproved,
  };
  outcomes.items.push(note);
  await writeJson(getRuntimeWritePath("evidence", "outcomes.json"), outcomes);
  const status = reviewApproved || runtimeApproved ? "GREEN" : "PENDING";
  const blockers =
    status === "GREEN"
      ? []
      : [
          "Automated DX/UX review must pass all runtime evidence checks or receive explicit review approval.",
          ...failedAutomatedReviewChecks,
        ];
  const nextAllowedTriggers = status === "GREEN" ? ["$build"] : ["$vibe"];
  await writeExperienceSpec({
    note,
    outcomeCount: outcomes.items.length,
    runtimeSummary,
    nextTrigger: status === "GREEN" ? "`$build`" : "`$vibe`",
  });

  await appendDecision({
    kind: "skill",
    skill: "$vibe",
    decision: "Recorded DX/UX review notes",
    status,
    evidence: [note],
    blockers,
    next_allowed_triggers: nextAllowedTriggers,
  });

  await syncStatusUpdates({ experience_status: status });
  await updateScratchpadTrackForLane({
    gate: "$vibe",
    trackStatus: status === "GREEN" ? "COMPLETED" : "BLOCKED",
    globalStatus: status === "GREEN" ? "COMPLETED" : "LOCKED",
    blockers,
    nextTriggers: nextAllowedTriggers,
    details: {
      operator_friction: note.operatorFriction,
      user_friction: note.userFriction,
    },
  });
}

export async function runMaestro({ autoHeal = false, parallel = false } = {}) {
  await assertLeaderAuthority();
  let runtimeSnapshot = await loadRuntimeSnapshot();
  let releaseState = runtimeSnapshot.release;
  let runtimeSummary = createRuntimeSummary(runtimeSnapshot);
  assertControlPlaneReady(runtimeSummary);
  let idea = await readIdeaText();
  let buildReadiness = evaluateRuntimeBuildReadiness(releaseState, runtimeSummary);
  let recommendation = chooseMaestroRecommendation(releaseState, idea, buildReadiness);
  const helperFailureMatrix = buildHelperFailureMatrix();
  const alignmentReport = {
    ...evaluateAlignmentDrift({
      releaseState,
      decisionLog: runtimeSnapshot.decisions,
    }),
    lastRunAt: new Date().toISOString(),
    baselineArtifacts: [
      ".ma/release.json",
      ".ma/decisions.json",
      ".ma/state/manager-runs.json",
      ".ma/state/maestro-state.json",
    ],
  };
  await saveAlignmentSentinelReport(alignmentReport);
  if (alignmentReport.driftStatus === "DRIFTED") {
    await updateScratchpadTrackForLane({
      gate: "$maestro",
      trackStatus: "BLOCKED",
      globalStatus: "LOCKED",
      blockers: alignmentReport.findings.map(
        (finding) =>
          `${finding.skill} expects ${finding.releaseField} to remain in ${finding.expectedReleaseValues.join(" or ")}, but the current value is ${finding.actualReleaseValue}.`,
      ),
      nextTriggers: ["$maestro"],
      details: {
        drift_status: alignmentReport.driftStatus,
        reboot_planned: alignmentReport.rebootPlanned,
        resume_trigger: alignmentReport.resumeTrigger,
      },
    });
    await appendMaestroEvent({
      record_type: "alignment:drift_detected",
      gate: "$maestro",
      findings: alignmentReport.findings,
      reboot_planned: alignmentReport.rebootPlanned,
      resume_trigger: alignmentReport.resumeTrigger,
    });
    const driftRecommendation = {
      nextStep: "Resolve alignment drift before manager dispatch continues.",
      why: alignmentReport.rebootReason,
      primaryLane: "$maestro",
      supportLane: "none",
      assignments: [
        "Review the persisted alignment report and conflicting lane-owned decisions.",
        "Rehydrate the next manager run from baseline `.ma/` artifacts after the conflicting state is repaired.",
      ],
      avoid: [
        "Do not continue autonomous dispatch while release state contradicts approved lane decisions.",
      ],
      nextTrigger: "`$maestro`",
    };
    await writeMaestroPlan({
      releaseState,
      recommendation: driftRecommendation,
      runtimeSummary,
      workflowSequence: maestroWorkflowSequence,
      managerRun: null,
    });
    await appendDecision({
      kind: "skill",
      skill: "$maestro",
      decision:
        "Alignment Sentinel blocked manager execution and requested a fresh worker rehydration path.",
      status: "BLOCKED",
      evidence: [alignmentReport],
      blockers: alignmentReport.findings.map(
        (finding) =>
          `${finding.skill} approved ${finding.expectedDecisionStatus}, but ${finding.releaseField} regressed to ${finding.actualReleaseValue}.`,
      ),
      next_allowed_triggers: ["$maestro"],
    });
    return;
  }
  if (
    autoHeal &&
    buildReadiness.releaseBlockers.length === 0 &&
    buildReadiness.nextTriggers.includes("repair runtime artifacts")
  ) {
    const repairedArtifacts = await repairRuntimeScratchpadArtifacts([
      ...runtimeSummary.invalidArtifacts,
      ...runtimeSummary.missingArtifacts,
    ]);
    if (repairedArtifacts.length > 0) {
      const detached = await launchDetachedTrack({
        trackId: "heal-sync",
        title: "Meta-Architect bounded diagnostic sidecar",
        command: "/bin/sh",
        args: [
          "-lc",
          `printf '%s\n' "Repaired scratchpad artifacts: ${repairedArtifacts.join(", ")}"`,
        ],
      });
      let maestroState = await loadMaestroStateOrDefault();
      maestroState = beginMaestroOrchestration(maestroState, {
        globalStatus: "DEGRADED_HEALING",
        configuration: {
          auto_heal: true,
          concurrency_limit: parallel ? 4 : 1,
        },
      });
      maestroState.runtime_tracks.track_heal_sync = {
        active_gate: "$maestro",
        status: "COMPLETED",
        pid: null,
        execution_pane: detached.executionPane,
        provider: detached.provider,
        log_path: detached.logPath,
        exit_code: 0,
        repaired_artifacts: repairedArtifacts,
        updated_at: new Date().toISOString(),
      };
      await saveMaestroState(maestroState);
      await appendMaestroEvent({
        record_type: "healing:attempt",
        gate: "$maestro",
        global_status: "DEGRADED_HEALING",
        track_status: "COMPLETED",
        repaired_artifacts: repairedArtifacts,
        repaired_count: repairedArtifacts.length,
      });
      runtimeSnapshot = await loadRuntimeSnapshot();
      releaseState = runtimeSnapshot.release;
      runtimeSummary = createRuntimeSummary(runtimeSnapshot);
      buildReadiness = evaluateRuntimeBuildReadiness(releaseState, runtimeSummary);
      recommendation = chooseMaestroRecommendation(releaseState, idea, buildReadiness);
    }
  }
  const registry = await loadManagerRunRegistry();
  const activeRun = getActiveManagerRun(registry);
  const managerAction = chooseMaestroManagerAction({
    releaseState,
    runtimeSummary,
    buildReadiness,
    recommendation,
    activeRun,
  });

  if (activeRun?.state === "waiting-review" && managerAction.nextAction === "recommend") {
    await writeMaestroPlan({
      releaseState,
      recommendation,
      runtimeSummary,
      workflowSequence: maestroWorkflowSequence,
      managerRun: activeRun,
    });
    await appendDecision({
      kind: "skill",
      skill: "$maestro",
      decision: "Held the manager in waiting-review until the pending proposal is resolved",
      status: "WAITING_REVIEW",
      evidence: buildManagerDecisionEvidence(activeRun, recommendation),
      blockers: buildManagerDecisionBlockers(activeRun, runtimeSummary, buildReadiness),
      next_allowed_triggers: [stripBackticks(recommendation.nextTrigger)],
    });
    return;
  }

  const managerRun = createManagerRun({
    parentRunId: activeRun?.id ?? null,
    triggeredBy: "$maestro",
    mode: managerAction.mode,
    nextAction: managerAction.nextAction,
    dispatchPlan: managerAction.dispatchPlan,
    pendingReview: managerAction.pendingReview ?? null,
  });
  registry.runs.push(managerRun);
  updateManagerRunTimestamps(managerRun);
  await saveManagerRunRegistry(registry);

  try {
    updateManagerRunTimestamps(managerRun, { state: "dispatching" });
    await saveManagerRunRegistry(registry);

    if (managerRun.helperRuns.length > 0) {
      const helpersCompleted = await executeManagerHelpers({
        registry,
        managerRun,
        releaseState,
        runtimeSummary,
        recommendation,
        helperFailureMatrix,
      });
      if (!helpersCompleted) {
        runtimeSnapshot = await loadRuntimeSnapshot();
        releaseState = runtimeSnapshot.release;
        runtimeSummary = createRuntimeSummary(runtimeSnapshot);
        buildReadiness = evaluateRuntimeBuildReadiness(releaseState, runtimeSummary);
        recommendation = chooseMaestroRecommendation(releaseState, idea, buildReadiness);
      }
    }

    if (managerRun.state !== "completed" && managerRun.nextAction === "dispatch-gated") {
      const gateRunners = getAutonomousGateRunners();
      for (const gate of managerRun.dispatchPlan.gated) {
        const runner = gateRunners[gate.skill];
        if (!runner) {
          gate.status = "recommended";
          continue;
        }

        const detached =
          parallel && ["$flow", "$vet", "$vibe", "$build"].includes(gate.skill)
            ? await launchDetachedTrack({
                trackId: `${managerRun.id}-${gate.skill.replaceAll("$", "")}`,
                title: `Meta-Architect detached track ${gate.skill}`,
                command: "/bin/sh",
                args: ["-lc", `printf '%s\n' "Detached scratchpad track for ${gate.skill}"`],
              })
            : null;
        gate.status = "running";
        updateManagerRunTimestamps(managerRun, { state: "running" });
        await saveManagerRunRegistry(registry);
        await updateScratchpadTrackForLane({
          gate: gate.skill,
          trackStatus: "RUNNING",
          globalStatus: "RUNNING",
          nextTriggers: [gate.skill],
          detached,
          details: {
            objective: gate.objective,
          },
        });
        await runner();
        gate.status = "completed";
        await saveManagerRunRegistry(registry);
      }
    }

    if (managerRun.state !== "completed" && managerRun.nextAction === "dispatch-team") {
      await executeManagerTeamDispatch(registry, managerRun);
    }
  } catch (error) {
    updateManagerRunTimestamps(managerRun, {
      state: "failed",
      retry: {
        count: managerRun.retry.count + 1,
        lastReason: error.message,
      },
    });
    await saveManagerRunRegistry(registry);
    throw error;
  }

  runtimeSnapshot = await loadRuntimeSnapshot();
  releaseState = runtimeSnapshot.release;
  runtimeSummary = createRuntimeSummary(runtimeSnapshot);
  assertControlPlaneReady(runtimeSummary);
  idea = await readIdeaText();
  buildReadiness = evaluateRuntimeBuildReadiness(releaseState, runtimeSummary);
  recommendation = chooseMaestroRecommendation(releaseState, idea, buildReadiness);

  if (managerRun.state === "dispatching" || managerRun.state === "running") {
    updateManagerRunTimestamps(managerRun, { state: "completed" });
    await saveManagerRunRegistry(registry);
  }

  await writeMaestroPlan({
    releaseState,
    recommendation,
    runtimeSummary,
    workflowSequence: maestroWorkflowSequence,
    managerRun,
  });
  await appendDecision({
    kind: "skill",
    skill: "$maestro",
    decision:
      "Executed the autonomous Meta-Architect manager run and persisted the control-plane record",
    status: getManagerDecisionStatus(managerRun),
    evidence: buildManagerDecisionEvidence(managerRun, recommendation),
    blockers: buildManagerDecisionBlockers(managerRun, runtimeSummary, buildReadiness),
    next_allowed_triggers: [stripBackticks(recommendation.nextTrigger)],
  });
}

export async function runInit() {
  const created = [];
  const targets = [
    ".codex/agents",
    ".codex/prompts",
    ".ma/skills",
    ".ma/evidence",
    ".ma/guidance",
    ".ma/memory",
    ".ma/hooks",
    ".ma/tasks",
    ".ma/workspaces",
    ".ma/state",
    ".ma/context",
    ".ma/specs",
    ".ma/plans",
    "mcp",
    "docs",
    "docs/qa",
    "sprint",
  ];

  for (const relative of targets) {
    const target = path.join(getRepoRoot(), relative);
    await fs.mkdir(target, { recursive: true });
    created.push(relative);
  }

  const templateCopies = [
    [
      path.join(packageRoot, ".codex", "agents", "Architect.toml"),
      path.join(getRepoRoot(), ".codex", "agents", "Architect.toml"),
    ],
    [
      path.join(packageRoot, ".codex", "agents", "Sage.toml"),
      path.join(getRepoRoot(), ".codex", "agents", "Sage.toml"),
    ],
    [
      path.join(packageRoot, ".codex", "agents", "Auditor.toml"),
      path.join(getRepoRoot(), ".codex", "agents", "Auditor.toml"),
    ],
    [
      path.join(packageRoot, ".codex", "agents", "Flow.toml"),
      path.join(getRepoRoot(), ".codex", "agents", "Flow.toml"),
    ],
    [
      path.join(packageRoot, ".codex", "agents", "Vibe.toml"),
      path.join(getRepoRoot(), ".codex", "agents", "Vibe.toml"),
    ],
    [
      path.join(packageRoot, ".codex", "agents", "Builder.toml"),
      path.join(getRepoRoot(), ".codex", "agents", "Builder.toml"),
    ],
    [
      path.join(packageRoot, ".codex", "hooks.json"),
      path.join(getRepoRoot(), ".codex", "hooks.json"),
    ],
    [
      path.join(packageRoot, ".codex", "prompts", "enforcement.md"),
      path.join(getRepoRoot(), ".codex", "prompts", "enforcement.md"),
    ],
    [
      path.join(packageRoot, ".codex", "prompts", "release-rules.md"),
      path.join(getRepoRoot(), ".codex", "prompts", "release-rules.md"),
    ],
    [
      path.join(packageRoot, ".codex", "prompts", "skill-contract.md"),
      path.join(getRepoRoot(), ".codex", "prompts", "skill-contract.md"),
    ],
    [
      path.join(packageRoot, ".codex", "prompts", "onboarding.md"),
      path.join(getRepoRoot(), ".codex", "prompts", "onboarding.md"),
    ],
    [path.join(packageRoot, "docs", "README.md"), path.join(getRepoRoot(), "docs", "README.md")],
    [
      path.join(packageRoot, "docs", "getting-started.md"),
      path.join(getRepoRoot(), "docs", "getting-started.md"),
    ],
    [path.join(packageRoot, "docs", "skills.md"), path.join(getRepoRoot(), "docs", "skills.md")],
    [
      path.join(packageRoot, "docs", "mcp-setup.md"),
      path.join(getRepoRoot(), "docs", "mcp-setup.md"),
    ],
    [
      path.join(packageRoot, "docs", "release-spec.md"),
      path.join(getRepoRoot(), "docs", "release-spec.md"),
    ],
    [
      path.join(packageRoot, "docs", "qa", "release-readiness-0.1.14.md"),
      path.join(getRepoRoot(), "docs", "qa", "release-readiness-0.1.14.md"),
    ],
    [
      path.join(packageRoot, "docs", "qa", "release-issue-gates-0.1.13.json"),
      path.join(getRepoRoot(), "docs", "qa", "release-issue-gates-0.1.13.json"),
    ],
  ];

  const sprintFiles = [
    "00-idea.md",
    "01-architecture.md",
    "02-oss-evidence.md",
    "03-logic.md",
    "04-security.md",
    "05-dx-ux.md",
    "06-build-plan.md",
    "07-release.md",
  ];

  for (const file of sprintFiles) {
    templateCopies.push([
      path.join(packageRoot, "sprint", file),
      path.join(getRepoRoot(), "sprint", file),
    ]);
  }

  for (const file of [
    "servers.json",
    "collections.json",
    "fallback.json",
    "local-capabilities.json",
  ]) {
    templateCopies.push([
      path.join(packageRoot, "mcp", file),
      path.join(getRepoRoot(), "mcp", file),
    ]);
  }

  for (const [src, dest] of templateCopies) {
    try {
      await fs.access(dest);
    } catch {
      await fs.copyFile(src, dest);
    }
  }

  await seedRuntimeArtifacts();

  await writeFileIfMissing(
    getRuntimeWritePath("decisions.json"),
    `${JSON.stringify(
      {
        schemaVersion: "0.1.0",
        idea_status: "DRAFT",
        architecture_status: "DRAFT",
        evidence_status: "MISSING",
        logic_status: "PENDING",
        security_status: "PENDING",
        experience_status: "PENDING",
        build_status: "LOCKED",
        merge_status: "LOCKED",
        release_status: "LOCKED",
        decisions: [],
      },
      null,
      2,
    )}\n`,
  );

  await writeFileIfMissing(
    getRuntimeWritePath("release.json"),
    `${JSON.stringify(
      {
        schemaVersion: "0.1.0",
        idea_status: "DRAFT",
        architecture_status: "DRAFT",
        evidence_status: "MISSING",
        logic_status: "PENDING",
        security_status: "PENDING",
        experience_status: "PENDING",
        build_status: "LOCKED",
        merge_status: "LOCKED",
        release_status: "LOCKED",
        waiver: null,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );

  for (const [fileName, content] of Object.entries(workflowTemplates)) {
    await writeFileIfMissing(getRuntimeWritePath("skills", fileName), content);
  }

  await writeFileIfMissing(
    path.join(getRepoRoot(), "mcp", "servers.json"),
    `${JSON.stringify({ schemaVersion: "0.1.0", servers: [] }, null, 2)}\n`,
  );
  await writeFileIfMissing(
    path.join(getRepoRoot(), "mcp", "local-capabilities.json"),
    `${JSON.stringify({ schemaVersion: "0.1.0", capabilities: [] }, null, 2)}\n`,
  );
  await writeFileIfMissing(
    path.join(getRepoRoot(), "mcp", "collections.json"),
    `${JSON.stringify({ schemaVersion: "0.1.0", collections: {} }, null, 2)}\n`,
  );
  await writeFileIfMissing(
    path.join(getRepoRoot(), "mcp", "fallback.json"),
    `${JSON.stringify(
      {
        schemaVersion: "0.1.0",
        fallback: {
          endpoint: "https://gitmcp.io/docs",
          policy: "Use only when no approved exact endpoint exists.",
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFileIfMissing(
    getRuntimeWritePath("evidence", "sources.json"),
    `${JSON.stringify(
      {
        schemaVersion: "0.1.0",
        items: [],
      },
      null,
      2,
    )}\n`,
  );
  await writeFileIfMissing(
    getRuntimeWritePath("evidence", "audits.json"),
    `${JSON.stringify(
      {
        schemaVersion: "0.1.0",
        items: [],
      },
      null,
      2,
    )}\n`,
  );
  await writeFileIfMissing(
    getRuntimeWritePath("evidence", "outcomes.json"),
    `${JSON.stringify(
      {
        schemaVersion: "0.1.0",
        items: [],
      },
      null,
      2,
    )}\n`,
  );
  await writeFileIfMissing(
    getRuntimeWritePath("evidence", "cves.json"),
    `${JSON.stringify(
      {
        schemaVersion: "0.1.0",
        items: [],
      },
      null,
      2,
    )}\n`,
  );

  await writeFileIfMissing(
    path.join(getRepoRoot(), "docs", "onboarding.md"),
    "# Onboarding\n\nMeta-Architect initializes the core scaffold, MCP config, and canonical .ma runtime files.\n",
  );

  return created;
}
