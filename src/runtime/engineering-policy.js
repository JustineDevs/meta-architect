import { ensureDir, readJson, writeFileIfMissing } from "../fs-utils.js";
import { getRuntimeSubsystemPath } from "../paths.js";

export const engineeringPolicySchemaVersion = "0.1.0";

const priorities = {
  P0: {
    label: "mission-critical",
    description:
      "A launch blocker, outage, security incident, data-loss risk, or immediate user/revenue impact.",
    response: "stabilize first, narrow scope, and require an explicit rollback path",
  },
  P1: {
    label: "core requirement",
    description: "Required for the release or task outcome, but not an active incident.",
    response: "design and verify before expanding scope",
  },
  P2: {
    label: "quality improvement",
    description:
      "Improves reliability, performance, maintainability, or user experience and can be sequenced after core delivery.",
    response: "deliver when it has a bounded benefit and verification path",
  },
  P3: {
    label: "future polish",
    description:
      "Useful cleanup or polish that does not affect the current outcome or safety boundary.",
    response: "defer unless the change is nearly free and does not distract from higher priorities",
  },
};

const stages = ["understand", "design", "trim", "guardrails", "rollout"];

function text(value) {
  return String(value ?? "").trim();
}

function normalizePriority(value) {
  const candidate = text(value).toUpperCase();
  if (candidate in priorities) return candidate;
  if (candidate === "CRITICAL") return "P0";
  if (candidate === "HIGH") return "P1";
  if (candidate === "NORMAL") return "P2";
  if (candidate === "LOW") return "P3";
  return null;
}

function containsAny(value, patterns) {
  return patterns.some((pattern) => pattern.test(value));
}

export function classifyEngineeringPriority({
  goal,
  requestedPriority = null,
  risk = "medium",
} = {}) {
  const explicit = normalizePriority(requestedPriority);
  if (explicit) {
    return {
      priority: explicit,
      rationale: "Explicit priority supplied by the task author.",
      source: "explicit",
    };
  }

  const normalizedGoal = text(goal).toLowerCase();
  if (
    containsAny(normalizedGoal, [
      /outage|incident|data loss|security breach|credential leak|production down/,
      /cannot launch|release blocker|revenue[- ]critical|customer[- ]blocking/,
    ]) ||
    risk === "critical"
  ) {
    return {
      priority: "P0",
      rationale:
        "The task contains an incident, safety, launch, or immediate customer-impact signal.",
      source: "policy",
    };
  }
  if (
    containsAny(normalizedGoal, [
      /required|must|core|implement|fix|release|migration|api|authentication|authorization/,
    ]) ||
    risk === "high"
  ) {
    return {
      priority: "P1",
      rationale: "The task changes a core behavior or is required for the requested outcome.",
      source: "policy",
    };
  }
  if (
    containsAny(normalizedGoal, [
      /performance|latency|reliability|test|refactor|accessibility|ux|quality/,
    ])
  ) {
    return {
      priority: "P2",
      rationale:
        "The task improves quality or operability without being an immediate delivery blocker.",
      source: "policy",
    };
  }
  return {
    priority: "P3",
    rationale:
      "No incident or core-delivery signal was found; treat this as deferrable polish until confirmed otherwise.",
    source: "policy",
  };
}

function defaultDefinitionOfDone(priority) {
  return [
    "The requested behavior is implemented or the reason for no code change is recorded.",
    "Focused tests cover the changed behavior and failure path.",
    "Quality, security, and release gates relevant to the change pass.",
    "A receipt records changed files, verification evidence, and unresolved risks.",
    ...(priority === "P0"
      ? ["A rollback or containment action is documented and executable."]
      : []),
  ];
}

function defaultStageEvidence(stage, priority) {
  const evidence = {
    understand: ["goal, constraints, affected surfaces, and edge cases are recorded"],
    design: ["smallest viable design, contracts, tradeoffs, and dependencies are recorded"],
    trim: ["scope is reduced to the minimum change that satisfies the definition of done"],
    guardrails: ["focused tests, static checks, security checks, and observability are defined"],
    rollout: [
      priority === "P0"
        ? "containment and rollback are verified before any external rollout"
        : "rollout channel, monitoring signal, and rollback path are recorded",
    ],
  };
  return evidence[stage];
}

export function createEngineeringPlan({
  goal,
  requestedPriority = null,
  risk = "medium",
  changeType = "code",
  verification = [],
  rollback = null,
  observability = [],
} = {}) {
  const cleanGoal = text(goal);
  if (!cleanGoal) throw new Error("engineering plan requires a goal");
  const classification = classifyEngineeringPriority({
    goal: cleanGoal,
    requestedPriority,
    risk,
  });
  const priority = classification.priority;
  const plan = {
    schemaVersion: engineeringPolicySchemaVersion,
    record_type: "senior_engineering_plan",
    goal: cleanGoal,
    change_type: text(changeType) || "code",
    triage: {
      priority,
      label: priorities[priority].label,
      rationale: classification.rationale,
      source: classification.source,
      response: priorities[priority].response,
    },
    execution_blueprint: stages.map((stage) => ({
      stage,
      required: true,
      evidence: defaultStageEvidence(stage, priority),
    })),
    definition_of_done: defaultDefinitionOfDone(priority),
    verification: [...new Set(verification.map(text).filter(Boolean))],
    observability: [...new Set(observability.map(text).filter(Boolean))],
    rollback:
      text(rollback) ||
      "Revert the bounded change using the owning branch or setup receipt before external promotion.",
    safe_rollout: {
      default_channel: priority === "P0" ? "containment" : "staged",
      require_canary_or_preview: priority !== "P3",
      monitor_before_promotion: true,
      external_mutation_requires_approval: true,
    },
    created_at: new Date().toISOString(),
  };
  return validateEngineeringPlan(plan);
}

export function validateEngineeringPlan(plan) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    throw new Error("engineering plan must be an object");
  }
  if (
    plan.schemaVersion !== engineeringPolicySchemaVersion ||
    plan.record_type !== "senior_engineering_plan"
  ) {
    throw new Error("invalid senior engineering plan schema");
  }
  if (!text(plan.goal)) throw new Error("engineering plan requires goal");
  const priority = normalizePriority(plan.triage?.priority);
  if (!priority) throw new Error("engineering plan requires a P0-P3 triage priority");
  if (
    !Array.isArray(plan.execution_blueprint) ||
    plan.execution_blueprint.length !== stages.length
  ) {
    throw new Error("engineering plan requires all five execution stages");
  }
  for (const [index, entry] of plan.execution_blueprint.entries()) {
    if (
      entry.stage !== stages[index] ||
      entry.required !== true ||
      !Array.isArray(entry.evidence) ||
      entry.evidence.length === 0
    ) {
      throw new Error(`engineering plan stage ${stages[index]} is incomplete`);
    }
  }
  if (!Array.isArray(plan.definition_of_done) || plan.definition_of_done.length === 0) {
    throw new Error("engineering plan requires a definition of done");
  }
  if (
    !plan.safe_rollout?.monitor_before_promotion ||
    plan.safe_rollout.external_mutation_requires_approval !== true
  ) {
    throw new Error(
      "engineering plan must require monitored rollout and approval for external mutation",
    );
  }
  return plan;
}

export function getEngineeringPolicyPath() {
  return getRuntimeSubsystemPath("context", "engineering-policy.json");
}

export function createDefaultEngineeringPolicy() {
  return {
    schemaVersion: engineeringPolicySchemaVersion,
    record_type: "engineering_policy",
    default: true,
    priorities,
    execution_blueprint: stages,
    invariants: [
      "Triage before implementation.",
      "Design and definition of done before source mutation for non-trivial work.",
      "Trim scope before adding abstractions or dependencies.",
      "Guardrails include tests, static checks, security checks, and observability appropriate to risk.",
      "Rollout is staged with monitoring and an executable rollback path.",
      "P0/P1 work cannot be silently downgraded to P2/P3 by an implementation convenience.",
    ],
  };
}

export async function seedEngineeringPolicyArtifacts() {
  await ensureDir(getRuntimeSubsystemPath("context"));
  await writeFileIfMissing(
    getEngineeringPolicyPath(),
    `${JSON.stringify(createDefaultEngineeringPolicy(), null, 2)}\n`,
  );
}

export async function loadEngineeringPolicy() {
  const policy = await readJson(getEngineeringPolicyPath());
  if (policy?.schemaVersion !== engineeringPolicySchemaVersion || policy?.default !== true) {
    throw new Error("invalid engineering policy artifact");
  }
  return policy;
}
