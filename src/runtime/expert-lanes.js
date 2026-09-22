const laneIds = ["arch", "sage", "flow", "vet", "vibe", "build"];
const laneStatuses = new Set(["eligible", "blocked", "completed", "skipped"]);

export const expertLanes = Object.freeze([
  {
    id: "arch",
    skill: "$arch",
    domain: "enterprise architecture",
    mission: "Define a coherent full-stack system boundary and evolution path.",
    owns: ["domain-model", "system-boundaries", "api-contracts", "data-ownership", "tradeoffs"],
    doesNotOwn: ["implementation-success", "security-approval", "release-approval"],
    inputs: ["task-contract", "project-context", "verified-sources"],
    outputs: ["architecture-decision", "component-model", "tradeoff-matrix", "risk-register"],
    sourceRoles: ["project", "authoritative", "reference"],
    invariants: ["Every boundary has an owner", "Rejected alternatives are recorded"],
    nextLanes: ["sage", "flow", "vet"],
  },
  {
    id: "sage",
    skill: "$sage",
    domain: "engineering evidence and technology selection",
    mission: "Select applicable technologies from pinned, provenance-checked sources.",
    owns: [
      "candidate-selection",
      "source-provenance",
      "license-fit",
      "maintenance-fit",
      "migration-cost",
    ],
    doesNotOwn: ["architecture-authority", "security-approval", "implementation-success"],
    inputs: ["architecture-decision", "task-contract", "source-registry"],
    outputs: ["candidate-matrix", "claim-receipts", "source-lock", "recommendation"],
    sourceRoles: ["project", "authoritative", "reference"],
    invariants: ["Discovery sources never unlock evidence", "Every claim has a pinned source"],
    nextLanes: ["flow", "vet"],
  },
  {
    id: "flow",
    skill: "$flow",
    domain: "runtime behavior and reliability",
    mission: "Prove state transitions, failure recovery, concurrency, and operational behavior.",
    owns: ["state-machines", "retries", "idempotency", "timeouts", "recovery", "backpressure"],
    doesNotOwn: ["technology-selection", "security-approval", "release-approval"],
    inputs: ["architecture-decision", "sage-receipts", "implementation", "tests"],
    outputs: ["runtime-model", "failure-matrix", "integration-evidence"],
    sourceRoles: ["project", "authoritative", "runtime"],
    invariants: ["Failure paths are explicit", "Retries are bounded and idempotent"],
    nextLanes: ["vet", "vibe", "build"],
  },
  {
    id: "vet",
    skill: "$vet",
    domain: "security, privacy, and trust boundaries",
    mission: "Identify and control security, privacy, supply-chain, and authorization risk.",
    owns: ["trust-boundaries", "authn-authz", "secrets", "input-safety", "dependencies", "privacy"],
    doesNotOwn: ["architecture-authority", "product-ux-approval"],
    inputs: ["architecture-decision", "runtime-model", "lockfiles", "source-receipts"],
    outputs: ["threat-model", "security-receipt", "required-controls", "residual-risks"],
    sourceRoles: ["project", "authoritative", "runtime"],
    invariants: ["Critical findings block progress", "Secrets never enter shared receipts"],
    nextLanes: ["flow", "vibe", "build"],
  },
  {
    id: "vibe",
    skill: "$vibe",
    domain: "product, user, operator, and developer experience",
    mission: "Make the system understandable, accessible, operable, and recoverable for humans.",
    owns: [
      "user-journeys",
      "error-recovery",
      "accessibility",
      "onboarding",
      "cli-ergonomics",
      "docs",
    ],
    doesNotOwn: ["security-approval", "release-approval"],
    inputs: ["task-contract", "architecture-decision", "runtime-failures"],
    outputs: ["journey-map", "interaction-states", "acceptance-scenarios", "ux-risks"],
    sourceRoles: ["project", "authoritative", "runtime"],
    invariants: ["Failure states are usable", "Operator actions are explicit"],
    nextLanes: ["build"],
  },
  {
    id: "build",
    skill: "$build",
    domain: "implementation, delivery, and production readiness",
    mission: "Integrate verified lane decisions into tested, deployable, reversible changes.",
    owns: [
      "file-changes",
      "tests",
      "build",
      "deployment",
      "rollback",
      "observability",
      "release-readiness",
    ],
    doesNotOwn: ["inventing-source-evidence", "overriding-security-blocks"],
    inputs: ["all-applicable-lane-receipts", "implementation-plan", "repository-state"],
    outputs: ["file-change-receipt", "test-receipt", "package-receipt", "release-decision"],
    sourceRoles: ["project", "runtime"],
    invariants: ["Fresh verification is required", "Rollback is defined before release"],
    nextLanes: [],
  },
]);

function assertStringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${label} must be a non-empty string array`);
  }
}

export function validateExpertLane(lane) {
  if (!lane || typeof lane !== "object" || Array.isArray(lane)) {
    throw new Error("Expert lane must be an object");
  }
  if (!laneIds.includes(lane.id) || lane.skill !== `$${lane.id}`) {
    throw new Error(`Unsupported expert lane identity: ${lane.id ?? "(missing)"}`);
  }
  for (const field of [
    "owns",
    "doesNotOwn",
    "inputs",
    "outputs",
    "sourceRoles",
    "invariants",
    "nextLanes",
  ]) {
    assertStringArray(lane[field], `${lane.id}.${field}`);
  }
  if (typeof lane.domain !== "string" || typeof lane.mission !== "string") {
    throw new Error(`${lane.id} requires domain and mission`);
  }
  return lane;
}

export function validateExpertLanes(lanes = expertLanes) {
  if (!Array.isArray(lanes) || lanes.length !== laneIds.length) {
    throw new Error(`Expert lane registry requires ${laneIds.length} lanes`);
  }
  const seen = new Set();
  for (const lane of lanes) {
    validateExpertLane(lane);
    if (seen.has(lane.id)) throw new Error(`Duplicate expert lane: ${lane.id}`);
    seen.add(lane.id);
  }
  return lanes;
}

export function getExpertLane(id) {
  return expertLanes.find((lane) => lane.id === id || lane.skill === id) ?? null;
}

export function createLaneReceipt({
  lane,
  status,
  decision,
  evidence = [],
  blockers = [],
  tradeoffs = [],
  assumptions = [],
  outputs = [],
}) {
  const resolved = getExpertLane(lane);
  if (!resolved) throw new Error(`Unknown expert lane: ${lane}`);
  if (!laneStatuses.has(status)) throw new Error(`Unsupported lane status: ${status}`);
  if (typeof decision !== "string" || !decision.trim())
    throw new Error("Lane decision is required");
  if (!Array.isArray(outputs) || outputs.some((output) => typeof output !== "string"))
    throw new Error("Lane outputs must be a string array");
  const unsupportedOutputs = outputs.filter((output) => !resolved.outputs.includes(output));
  if (unsupportedOutputs.length > 0) {
    throw new Error(
      `Lane ${resolved.id} claimed outputs it does not own: ${unsupportedOutputs.join(", ")}`,
    );
  }
  return {
    schemaVersion: "1.0.0",
    recordType: "expert_lane_receipt",
    lane: resolved.id,
    skill: resolved.skill,
    domain: resolved.domain,
    status,
    decision,
    evidence: Array.isArray(evidence) ? evidence : [],
    blockers: Array.isArray(blockers) ? blockers : [],
    tradeoffs: Array.isArray(tradeoffs) ? tradeoffs : [],
    assumptions: Array.isArray(assumptions) ? assumptions : [],
    outputs: [...new Set(outputs)],
    ownership: {
      owns: resolved.owns,
      doesNotOwn: resolved.doesNotOwn,
    },
    createdAt: new Date().toISOString(),
  };
}

validateExpertLanes();
