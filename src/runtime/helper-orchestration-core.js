import { ensureDir, readJson, writeFileIfMissing } from "../fs-utils.js";
import { getRuntimeSubsystemPath } from "../paths.js";

export const helperOrchestrationSchemaVersion = "0.1.0";
export const helperSkillNames = ["$align", "$diagnose", "$tdd", "$cleanup"];

const helperContracts = [
  {
    skill: "$align",
    semantic_role: "scope_alignment",
    activates_when: [
      "ambiguous_scope",
      "terminology_drift",
      "lane_handoff_needs_shared_language",
      "docs_or_prompt_contract_needs_tightening",
    ],
    outputs: [
      "current_ambiguity_or_mismatch",
      "normalized_terminology",
      "scope_boundary_and_exclusions",
      "acceptance_checks_or_rewritten_prompts",
      "exact_next_trigger",
    ],
    supports: ["$maestro", "$arch", "$sage", "$flow", "$vet", "$vibe", "$build"],
    records_as: "helper_alignment_receipt",
  },
  {
    skill: "$diagnose",
    semantic_role: "blocked_lane_diagnosis",
    activates_when: [
      "lane_blocked",
      "vague_symptom",
      "runtime_artifact_invalid",
      "missing_evidence_or_reproduction_boundary",
    ],
    outputs: [
      "observed_symptom",
      "likely_failure_slices",
      "missing_evidence_or_repro_steps",
      "smallest_next_probe",
      "exact_next_trigger",
    ],
    supports: ["$maestro", "$flow", "$vet", "$build", "verifier_roles", "debugger_roles"],
    records_as: "helper_diagnosis_receipt",
  },
  {
    skill: "$tdd",
    semantic_role: "regression_first_boundary",
    activates_when: [
      "implementation_expanding",
      "cleanup_requires_behavior_lock",
      "bounded_build_slice_needs_test_shape",
      "regression_risk_before_refactor",
    ],
    outputs: [
      "behavior_to_lock",
      "minimal_regression_or_failing_test_shape",
      "implementation_boundary",
      "proof_test_belongs_to_change",
      "exact_next_trigger",
    ],
    supports: ["$maestro", "$build", "executor_roles", "test_engineer_roles", "$cleanup"],
    records_as: "helper_tdd_receipt",
  },
  {
    skill: "$cleanup",
    semantic_role: "contract_preserving_simplification",
    activates_when: [
      "artifact_is_noisy_after_decision",
      "anti_slop_pass_needed",
      "docs_need_product_native_wording",
      "code_or_plan_can_be_simplified_without_behavior_change",
    ],
    outputs: [
      "removable_complexity_or_noisy_wording",
      "behavior_preserving_simplifications",
      "residual_risks_after_cleanup",
      "exact_next_trigger",
    ],
    supports: ["$maestro", "$arch", "$sage", "$flow", "$vet", "$vibe", "$build", "writer_roles"],
    records_as: "helper_cleanup_receipt",
  },
];

export function getHelperOrchestrationCorePath() {
  return getRuntimeSubsystemPath("context", "helper-orchestration-core.json");
}

export function createDefaultHelperOrchestrationCore() {
  return {
    schemaVersion: helperOrchestrationSchemaVersion,
    product: "Meta-Architect",
    purpose:
      "Defines how $align, $diagnose, $tdd, and $cleanup work together as core non-gating helper capabilities across MA lanes, roles, workers, and exported host payloads.",
    helper_contracts: helperContracts,
    composition_rules: {
      non_gating: true,
      release_state_mutation_allowed: false,
      may_create_parallel_release_gate: false,
      authority_returns_to: "$maestro_or_owning_lane",
      can_run_before_lane: true,
      can_run_between_lanes: true,
      can_run_after_lane: true,
      records_as: "helper_receipt",
      never_records_as: "gate_approval",
    },
    role_application: {
      all_roles_may_consume_helper_receipts: true,
      planner_roles: ["$align", "$diagnose"],
      architect_roles: ["$align", "$diagnose", "$cleanup"],
      executor_roles: ["$tdd", "$cleanup", "$diagnose"],
      verifier_roles: ["$diagnose", "$tdd", "$cleanup"],
      writer_roles: ["$align", "$cleanup"],
      team_workers: ["$align", "$diagnose", "$tdd", "$cleanup"],
      exported_host_payloads: ["$align", "$diagnose", "$tdd", "$cleanup"],
    },
    handoff_contract: {
      required_fields: [
        "skill",
        "semantic_role",
        "objective",
        "observed_context",
        "result",
        "does_not_unlock",
        "next_trigger",
      ],
      does_not_unlock: [
        "release_state_transition",
        "build_gate",
        "merge_gate",
        "production_release",
      ],
    },
  };
}

export function validateHelperOrchestrationCore(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("helper orchestration core must be an object");
  }
  if (value.schemaVersion !== helperOrchestrationSchemaVersion) {
    throw new Error(`Unsupported helper orchestration schemaVersion: ${value.schemaVersion}`);
  }
  if (!Array.isArray(value.helper_contracts)) {
    throw new Error("helper orchestration core requires helper_contracts");
  }
  const found = value.helper_contracts.map((contract) => contract.skill).sort();
  const expected = [...helperSkillNames].sort();
  if (JSON.stringify(found) !== JSON.stringify(expected)) {
    throw new Error("helper orchestration core must define all four helper skills exactly once");
  }
  for (const contract of value.helper_contracts) {
    if (
      typeof contract.semantic_role !== "string" ||
      !Array.isArray(contract.activates_when) ||
      !Array.isArray(contract.outputs) ||
      !Array.isArray(contract.supports) ||
      typeof contract.records_as !== "string"
    ) {
      throw new Error(
        "helper contracts require semantic_role, activates_when, outputs, supports, records_as",
      );
    }
  }
  if (value.composition_rules?.release_state_mutation_allowed !== false) {
    throw new Error("helper orchestration core must not allow release-state mutation");
  }
  if (value.composition_rules?.never_records_as !== "gate_approval") {
    throw new Error("helper orchestration core must never record as gate approval");
  }
  return value;
}

export function resolveHelperContract(skill, core = createDefaultHelperOrchestrationCore()) {
  const document = validateHelperOrchestrationCore(core);
  const contract = document.helper_contracts.find((entry) => entry.skill === skill);
  if (!contract) {
    throw new Error(`Unknown helper skill: ${skill}`);
  }
  return contract;
}

export function chooseHelperRoute({
  releaseState = {},
  runtimeSummary = {},
  taskIntent = "",
} = {}) {
  const intent = taskIntent.toLowerCase();
  const helpers = [];
  const add = (skill, reason) => {
    if (!helpers.some((entry) => entry.skill === skill)) {
      helpers.push({ skill, reason });
    }
  };

  if (
    releaseState.idea_status !== "CLEAR" ||
    releaseState.architecture_status !== "APPROVED" ||
    intent.includes("scope") ||
    intent.includes("terminology") ||
    intent.includes("prompt")
  ) {
    add("$align", "Normalize scope, shared language, and the next owning lane.");
  }
  if (
    releaseState.logic_status === "RED" ||
    releaseState.security_status === "RED" ||
    runtimeSummary.pendingMailboxCount > 0 ||
    runtimeSummary.invalidArtifacts?.length > 0 ||
    intent.includes("blocked") ||
    intent.includes("failure")
  ) {
    add("$diagnose", "Decompose blockers into reproducible slices and next probes.");
  }
  if (
    ["READY", "RUNNING"].includes(releaseState.build_status) ||
    intent.includes("test") ||
    intent.includes("regression") ||
    intent.includes("refactor")
  ) {
    add("$tdd", "Lock behavior before implementation expands or cleanup changes code.");
  }
  if (
    releaseState.build_status === "DONE" ||
    intent.includes("cleanup") ||
    intent.includes("polish") ||
    intent.includes("slop") ||
    intent.includes("docs")
  ) {
    add("$cleanup", "Simplify artifacts without changing the owning lane decision.");
  }

  return {
    record_type: "helper_route_recommendation",
    helpers,
    helper_count: helpers.length,
    non_gating: true,
    release_state_mutation_allowed: false,
    next_owner:
      helpers.length === 0
        ? "$maestro_or_owning_lane"
        : helpers.at(-1).skill === "$cleanup"
          ? "$maestro_or_release_verification"
          : "$maestro_or_owning_lane",
  };
}

export function createHelperReceipt({
  skill,
  objective,
  observedContext,
  result,
  nextTrigger,
  core = createDefaultHelperOrchestrationCore(),
}) {
  const contract = resolveHelperContract(skill, core);
  if (!objective || !observedContext || !result || !nextTrigger) {
    throw new Error("helper receipt requires objective, observedContext, result, and nextTrigger");
  }
  return {
    record_type: "helper_receipt",
    skill,
    semantic_role: contract.semantic_role,
    objective,
    observed_context: observedContext,
    result,
    records_as: contract.records_as,
    does_not_unlock: ["release_state_transition", "build_gate", "merge_gate", "production_release"],
    next_trigger: nextTrigger,
    authority: "$maestro_or_owning_lane",
    created_at: new Date().toISOString(),
  };
}

export function evaluateHelperCoreCoverage(core = createDefaultHelperOrchestrationCore()) {
  const document = validateHelperOrchestrationCore(core);
  const supportedRoles = new Set();
  for (const contract of document.helper_contracts) {
    for (const support of contract.supports) {
      supportedRoles.add(support);
    }
  }
  return {
    record_type: "helper_core_coverage",
    helper_count: document.helper_contracts.length,
    helper_skills: document.helper_contracts.map((contract) => contract.skill),
    supported_surface_count: supportedRoles.size,
    non_gating: document.composition_rules.non_gating === true,
    release_state_mutation_allowed:
      document.composition_rules.release_state_mutation_allowed === true,
    all_helpers_defined: helperSkillNames.every((skill) =>
      document.helper_contracts.some((contract) => contract.skill === skill),
    ),
  };
}

export async function seedHelperOrchestrationCoreArtifacts() {
  await ensureDir(getRuntimeSubsystemPath("context"));
  await writeFileIfMissing(
    getHelperOrchestrationCorePath(),
    `${JSON.stringify(createDefaultHelperOrchestrationCore(), null, 2)}\n`,
  );
}

export async function loadHelperOrchestrationCore() {
  return validateHelperOrchestrationCore(await readJson(getHelperOrchestrationCorePath()));
}
