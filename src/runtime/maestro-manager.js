import { randomUUID } from "node:crypto";
import { readJson, writeFileIfMissing, writeJson } from "../fs-utils.js";
import { getRuntimeStatePath } from "../paths.js";

const managerModes = new Set(["helper-only", "helper+gated", "team"]);
const managerStates = new Set([
  "planned",
  "dispatching",
  "running",
  "waiting-review",
  "completed",
  "blocked",
  "failed",
  "cancelled",
]);
const managerNextActions = new Set([
  "recommend",
  "dispatch-helper",
  "dispatch-gated",
  "dispatch-team",
]);

export function getManagerRunsPath() {
  return getRuntimeStatePath("manager-runs.json");
}

export function createDefaultManagerRunRegistry() {
  return {
    schemaVersion: "0.1.0",
    runs: [],
  };
}

function normalizeHelperPlanEntry(entry) {
  return {
    id: entry?.id ?? `helper-${randomUUID()}`,
    skill: entry?.skill ?? "$align",
    objective: entry?.objective ?? "Provide bounded manager support",
    dependencies: Array.isArray(entry?.dependencies) ? [...entry.dependencies] : [],
    authorityMode: entry?.authorityMode ?? "manager-transient-helper",
    status: entry?.status ?? "planned",
    evidence: Array.isArray(entry?.evidence) ? [...entry.evidence] : [],
    errorClass: entry?.errorClass ?? null,
    errorMessage: entry?.errorMessage ?? null,
    startedAt: entry?.startedAt ?? null,
    completedAt: entry?.completedAt ?? null,
  };
}

function normalizeGatedPlanEntry(entry) {
  return {
    skill: entry?.skill ?? "$arch",
    objective: entry?.objective ?? "Advance the next gated lane",
    owner: entry?.owner ?? entry?.skill ?? "$arch",
    prerequisites: Array.isArray(entry?.prerequisites) ? [...entry.prerequisites] : [],
    status: entry?.status ?? "planned",
  };
}

function normalizeTeamPlanEntry(entry) {
  if (!entry) {
    return null;
  }

  return {
    title: entry.title ?? "Meta-Architect durable team task",
    objective: entry.objective ?? "Coordinate a durable delivery lane",
    verificationOwner: entry.verificationOwner ?? "leader",
    launchHints: Array.isArray(entry.launchHints) ? [...entry.launchHints] : [],
    staffing: Array.isArray(entry.staffing) ? [...entry.staffing] : [],
    createdTaskIds: Array.isArray(entry.createdTaskIds) ? [...entry.createdTaskIds] : [],
  };
}

function normalizeDispatchPlan(plan = {}) {
  return {
    helpers: Array.isArray(plan.helpers) ? plan.helpers.map(normalizeHelperPlanEntry) : [],
    gated: Array.isArray(plan.gated) ? plan.gated.map(normalizeGatedPlanEntry) : [],
    team: normalizeTeamPlanEntry(plan.team),
  };
}

function normalizePendingReview(pendingReview = {}) {
  const value = pendingReview ?? {};
  return {
    proposalPath: value.proposalPath ?? null,
    mailboxOwner: value.mailboxOwner ?? null,
    resumeTrigger: value.resumeTrigger ?? null,
  };
}

function normalizeRetry(retry = {}) {
  const value = retry ?? {};
  return {
    count: Number.isInteger(value.count) ? value.count : 0,
    lastReason: value.lastReason ?? null,
  };
}

function validateManagerRun(run) {
  if (!run || typeof run !== "object" || Array.isArray(run)) {
    throw new Error("Manager run must be an object");
  }
  if (typeof run.id !== "string" || run.id.trim() === "") {
    throw new Error("Manager run requires an id");
  }
  if (!(run.parentRunId === null || typeof run.parentRunId === "string")) {
    throw new Error("Manager run parentRunId must be null or a string");
  }
  if (typeof run.triggeredBy !== "string" || run.triggeredBy.trim() === "") {
    throw new Error("Manager run requires triggeredBy");
  }
  if (!managerModes.has(run.mode)) {
    throw new Error(`Unsupported manager mode: ${run.mode}`);
  }
  if (!managerStates.has(run.state)) {
    throw new Error(`Unsupported manager state: ${run.state}`);
  }
  if (!managerNextActions.has(run.nextAction)) {
    throw new Error(`Unsupported manager next action: ${run.nextAction}`);
  }
  if (
    !run.dispatchPlan ||
    typeof run.dispatchPlan !== "object" ||
    Array.isArray(run.dispatchPlan)
  ) {
    throw new Error("Manager run dispatchPlan must be an object");
  }
  if (!Array.isArray(run.dispatchPlan.helpers) || !Array.isArray(run.dispatchPlan.gated)) {
    throw new Error("Manager run dispatchPlan requires helpers and gated arrays");
  }
  if (
    !run.pendingReview ||
    typeof run.pendingReview !== "object" ||
    Array.isArray(run.pendingReview)
  ) {
    throw new Error("Manager run pendingReview must be an object");
  }
  if (!run.retry || typeof run.retry !== "object" || Array.isArray(run.retry)) {
    throw new Error("Manager run retry must be an object");
  }
  if (!Array.isArray(run.helperRuns)) {
    throw new Error("Manager run helperRuns must be an array");
  }

  return run;
}

export function validateManagerRunRegistry(registry) {
  if (!registry || typeof registry !== "object" || !Array.isArray(registry.runs)) {
    throw new Error("Manager run registry must contain a runs array");
  }

  for (const run of registry.runs) {
    validateManagerRun(run);
  }

  return registry;
}

export async function seedMaestroManagerArtifacts() {
  await writeFileIfMissing(
    getManagerRunsPath(),
    `${JSON.stringify(createDefaultManagerRunRegistry(), null, 2)}\n`,
  );
}

export async function loadManagerRunRegistry() {
  return validateManagerRunRegistry(await readJson(getManagerRunsPath()));
}

export async function loadManagerRunRegistryOrDefault() {
  try {
    return await loadManagerRunRegistry();
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return createDefaultManagerRunRegistry();
    }

    throw error;
  }
}

export async function saveManagerRunRegistry(registry) {
  validateManagerRunRegistry(registry);
  await writeJson(getManagerRunsPath(), registry);
  return registry;
}

export function getActiveManagerRun(registry) {
  return (
    [...(registry?.runs ?? [])]
      .reverse()
      .find((run) => !["completed", "blocked", "failed", "cancelled"].includes(run.state)) ?? null
  );
}

export function createManagerRun({
  triggeredBy = "$maestro",
  parentRunId = null,
  mode = "helper-only",
  nextAction = "recommend",
  dispatchPlan = {},
  pendingReview = null,
  retry = null,
} = {}) {
  const now = new Date().toISOString();
  const normalizedDispatchPlan = normalizeDispatchPlan(dispatchPlan);

  return validateManagerRun({
    id: `run-${randomUUID()}`,
    parentRunId,
    triggeredBy,
    mode,
    state: "planned",
    nextAction,
    dispatchPlan: normalizedDispatchPlan,
    helperRuns: normalizedDispatchPlan.helpers.map((helper) => ({ ...helper })),
    pendingReview: normalizePendingReview(pendingReview),
    retry: normalizeRetry(retry),
    startedAt: now,
    updatedAt: now,
    completedAt: null,
  });
}

function createHelperPlan(skill, objective, extras = {}) {
  return normalizeHelperPlanEntry({
    skill,
    objective,
    ...extras,
  });
}

function createGatedPlan(skill, objective, extras = {}) {
  return normalizeGatedPlanEntry({
    skill,
    objective,
    owner: skill,
    ...extras,
  });
}

export function buildHelperFailureMatrix() {
  return {
    helper_failed_noncritical: {
      outcome: "continue",
      requiredTraceFields: [
        "runId",
        "helperId",
        "skill",
        "objective",
        "errorClass",
        "errorMessage",
        "continuedHelpers",
      ],
      resumeOwner: null,
      siblingHelperPolicy: "continue-unaffected",
    },
    helper_failed_requires_human_or_leader: {
      outcome: "waiting-review",
      requiredTraceFields: [
        "runId",
        "helperId",
        "skill",
        "objective",
        "proposalPath",
        "mailboxOwner",
        "resumeTrigger",
      ],
      resumeOwner: "leader",
      siblingHelperPolicy: "continue-started-unaffected-only",
    },
    helper_failed_blocks_gate_prerequisite: {
      outcome: "blocked",
      requiredTraceFields: [
        "runId",
        "helperId",
        "skill",
        "objective",
        "blockedGate",
        "blockingReason",
        "requiredNextTrigger",
      ],
      resumeOwner: "leader",
      siblingHelperPolicy: "stop-dependent-helpers",
    },
    helper_failed_but_manager_can_fall_back_to_safe_summary: {
      outcome: "degrade-to-recommendation",
      requiredTraceFields: [
        "runId",
        "helperId",
        "skill",
        "objective",
        "degradedReason",
        "safeNextTrigger",
      ],
      resumeOwner: "user",
      siblingHelperPolicy: "stop-new-helper-launches",
    },
  };
}

export function chooseMaestroManagerAction({
  releaseState,
  runtimeSummary,
  buildReadiness,
  recommendation,
  activeRun = null,
} = {}) {
  if (activeRun?.state === "waiting-review") {
    return {
      mode: activeRun.mode,
      nextAction: "recommend",
      dispatchPlan: {
        helpers: [],
        gated: [],
        team: null,
      },
      pendingReview: { ...activeRun.pendingReview },
      reason:
        "A previous manager run is waiting for review before new authoritative work can begin.",
    };
  }

  if (releaseState.idea_status !== "CLEAR") {
    return {
      mode: "helper-only",
      nextAction: "recommend",
      dispatchPlan: {
        helpers: [],
        gated: [],
        team: null,
      },
      reason: recommendation?.why ?? "The brief is still missing.",
    };
  }

  const helpers = [];
  if (releaseState.architecture_status !== "APPROVED") {
    helpers.push(
      createHelperPlan(
        "$align",
        "Align the brief and manager-owned lane sequence before architecture work begins.",
      ),
    );
    return {
      mode: "helper+gated",
      nextAction: "dispatch-gated",
      dispatchPlan: {
        helpers,
        gated: [
          createGatedPlan(
            "$arch",
            "Shape the active brief into an approved architecture baseline.",
            {
              prerequisites: ["idea_status=CLEAR"],
            },
          ),
        ],
        team: null,
      },
      reason: recommendation?.why ?? "Advance the architecture gate under manager supervision.",
    };
  }
  if (releaseState.evidence_status !== "VERIFIED") {
    return {
      mode: "helper+gated",
      nextAction: "dispatch-gated",
      dispatchPlan: {
        helpers: [],
        gated: [
          createGatedPlan(
            "$sage",
            "Bind the architecture to approved evidence sources and capture live verification state.",
            { prerequisites: ["architecture_status=APPROVED"] },
          ),
        ],
        team: null,
      },
      reason: recommendation?.why ?? "Advance the evidence gate under manager supervision.",
    };
  }
  if (releaseState.logic_status !== "GREEN") {
    if (releaseState.logic_status === "RED") {
      return {
        mode: "helper-only",
        nextAction: "dispatch-helper",
        dispatchPlan: {
          helpers: [
            createHelperPlan(
              "$diagnose",
              "Decompose the logic blocker into concrete causes and probes.",
            ),
            createHelperPlan(
              "$align",
              "Clarify the exact next logic-lane input and rerun boundary.",
            ),
          ],
          gated: [],
          team: null,
        },
        reason:
          recommendation?.why ??
          "Logic is blocked, so helper diagnosis is safer than forcing the gate.",
      };
    }
    return {
      mode: "helper+gated",
      nextAction: "dispatch-gated",
      dispatchPlan: {
        helpers: [],
        gated: [
          createGatedPlan(
            "$flow",
            "Validate runtime actors, state transitions, and current blockers.",
            { prerequisites: ["idea_status=CLEAR", "evidence_status=VERIFIED"] },
          ),
        ],
        team: null,
      },
      reason: recommendation?.why ?? "Advance the logic gate under manager supervision.",
    };
  }
  if (releaseState.security_status !== "GREEN") {
    return {
      mode: "helper+gated",
      nextAction: "dispatch-gated",
      dispatchPlan: {
        helpers: [],
        gated: [
          createGatedPlan(
            "$vet",
            "Record the current security review status and trust-boundary evidence.",
            { prerequisites: ["logic_status=GREEN|RED"] },
          ),
        ],
        team: null,
      },
      reason: recommendation?.why ?? "Advance the security gate under manager supervision.",
    };
  }
  if (!["GREEN", "WAIVED"].includes(releaseState.experience_status)) {
    return {
      mode: "helper+gated",
      nextAction: "dispatch-gated",
      dispatchPlan: {
        helpers: [],
        gated: [
          createGatedPlan(
            "$vibe",
            "Record the current DX/UX review status and remaining workflow friction.",
            { prerequisites: ["security_status=GREEN|PENDING|RED"] },
          ),
        ],
        team: null,
      },
      reason: recommendation?.why ?? "Advance the experience gate under manager supervision.",
    };
  }

  if (runtimeSummary.pendingMailboxCount > 0 || runtimeSummary.invalidArtifacts.length > 0) {
    return {
      mode: "helper-only",
      nextAction: "dispatch-helper",
      dispatchPlan: {
        helpers: [
          createHelperPlan(
            "$diagnose",
            "Summarize pending mailbox proposals and invalid runtime artifacts before durable progress continues.",
          ),
          createHelperPlan(
            "$align",
            "Normalize the owner-facing next actions around the pending proposals and runtime blockers.",
          ),
        ],
        gated: [],
        team: null,
      },
      reason: recommendation?.why ?? "Runtime blockers still require helper-only diagnosis.",
    };
  }

  if (releaseState.build_status === "LOCKED") {
    const buildHelpers = [];
    if (buildReadiness && buildReadiness.releaseBlockers.length === 0 && !buildReadiness.allowed) {
      buildHelpers.push(
        createHelperPlan(
          "$diagnose",
          "Capture the exact runtime blockers preventing build-readiness unlock.",
        ),
      );
      buildHelpers.push(
        createHelperPlan(
          "$align",
          "Prepare a bounded repair summary for the next review or manager resume trigger.",
        ),
      );
      return {
        mode: "helper-only",
        nextAction: "dispatch-helper",
        dispatchPlan: {
          helpers: buildHelpers,
          gated: [],
          team: null,
        },
        reason: recommendation?.why ?? "Runtime blockers still prevent build unlock.",
      };
    }

    return {
      mode: "helper+gated",
      nextAction: "dispatch-gated",
      dispatchPlan: {
        helpers: [],
        gated: [
          createGatedPlan("$build", "Unlock bounded build planning and branch guidance.", {
            prerequisites: ["experience_status=GREEN|WAIVED"],
          }),
        ],
        team: null,
      },
      reason: recommendation?.why ?? "The next bounded action belongs to the build lane.",
    };
  }

  if (["READY", "RUNNING"].includes(releaseState.build_status)) {
    return {
      mode: "helper+gated",
      nextAction: "dispatch-gated",
      dispatchPlan: {
        helpers: [],
        gated: [
          createGatedPlan(
            "$build",
            "Advance the bounded build execution substep and persist lane-owned build evidence.",
            { prerequisites: ["build_status=READY|RUNNING"] },
          ),
        ],
        team: null,
      },
      reason: recommendation?.why ?? "The build lane still owns the next bounded execution step.",
    };
  }

  if (releaseState.merge_status !== "MERGED_TO_DEVELOPMENT") {
    return {
      mode: "team",
      nextAction: "dispatch-team",
      dispatchPlan: {
        helpers: [
          createHelperPlan(
            "$tdd",
            "Prepare verification expectations for the implementation handoff.",
          ),
        ],
        gated: [],
        team: {
          title: "Complete the current bounded implementation slice",
          objective: "Finish the ready build slice and prepare a development merge.",
          verificationOwner: "leader",
          staffing: ["implementation", "verification"],
          launchHints: [
            "Keep release-plane ownership in the gated lanes.",
            "Return to $maestro after the bounded slice is complete.",
          ],
        },
      },
      reason: recommendation?.why ?? "The build slice now needs durable coordinated execution.",
    };
  }

  if (releaseState.release_status !== "SHIPPED_TO_PROD") {
    return {
      mode: "team",
      nextAction: "dispatch-team",
      dispatchPlan: {
        helpers: [],
        gated: [],
        team: {
          title: "Prepare the release promotion handoff",
          objective: "Coordinate verification and controlled promotion to prod.",
          verificationOwner: "leader",
          staffing: ["release", "verification"],
          launchHints: [
            "Confirm the origin branch is approved for release.",
            "Do not claim release success without channel-specific evidence.",
          ],
        },
      },
      reason: recommendation?.why ?? "The remaining work is coordinated release promotion.",
    };
  }

  return {
    mode: "helper-only",
    nextAction: "recommend",
    dispatchPlan: {
      helpers: [],
      gated: [],
      team: null,
    },
    reason: recommendation?.why ?? "No further manager action is required.",
  };
}
