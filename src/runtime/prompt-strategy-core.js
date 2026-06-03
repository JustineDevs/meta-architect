import { ensureDir, readJson, writeFileIfMissing } from "../fs-utils.js";
import { getRuntimeSubsystemPath } from "../paths.js";

export const promptStrategyCoreSchemaVersion = "0.1.0";

export function getPromptStrategyCorePath() {
  return getRuntimeSubsystemPath("context", "prompt-strategy-core.json");
}

export function createDefaultPromptStrategyCore() {
  return {
    schemaVersion: promptStrategyCoreSchemaVersion,
    product: "Meta-Architect",
    purpose:
      "First-party MA policy for selecting prompt strategies across lanes, roles, workers, reviewers, and exported host payloads.",
    evidence_source: {
      kind: "gitmcp-evidence",
      category: "prompt-techniques",
      repo: "NirDiamant/Prompt_Engineering",
      endpoint: "https://gitmcp.io/NirDiamant/Prompt_Engineering",
      reference_path: "all_prompt_engineering_techniques",
    },
    technique_families: [
      {
        id: "clarity_control",
        semantic_role: "ambiguity_reduction",
        reference_topics: [
          "ambiguity-clarity",
          "basic-prompt-structures",
          "instruction-engineering",
          "specific-task-prompts",
        ],
        ma_use:
          "Clarify task intent, output contract, constraints, and unknowns before lane execution.",
      },
      {
        id: "decomposition_sequence",
        semantic_role: "work_breakdown",
        reference_topics: ["task-decomposition-prompts", "prompt-chaining-sequencing"],
        ma_use:
          "Break broad requests into lane-owned steps, PRD stories, and verification handoffs.",
      },
      {
        id: "reasoning_validation",
        semantic_role: "answer_quality_control",
        reference_topics: [
          "cot-prompting",
          "self-consistency",
          "evaluating-prompt-effectiveness",
          "prompt-optimization-techniques",
        ],
        ma_use:
          "Use structured reasoning and cross-checks internally, then emit evidence-backed conclusions rather than private reasoning traces.",
      },
      {
        id: "generation_constraints",
        semantic_role: "bounded_output_shape",
        reference_topics: [
          "constrained-guided-generation",
          "negative-prompting",
          "prompt-formatting-structure",
          "prompt-templates-variables-jinja2",
        ],
        ma_use:
          "Constrain lane artifacts, host payloads, semantic receipts, and compatibility exports.",
      },
      {
        id: "context_and_examples",
        semantic_role: "context_selection",
        reference_topics: [
          "zero-shot-prompting",
          "few-shot-learning",
          "role-prompting",
          "prompt-length-complexity-management",
          "multilingual-prompting",
        ],
        ma_use:
          "Select minimal examples, role boundaries, language constraints, and context budgets for each workspace surface.",
      },
      {
        id: "safety_integrity",
        semantic_role: "prompt_safety",
        reference_topics: ["prompt-security-and-safety", "ethical-prompt-engineering"],
        ma_use:
          "Preserve security warnings, redaction boundaries, authority semantics, and high-stakes safety language.",
      },
    ],
    lane_policy: {
      $maestro: ["clarity_control", "decomposition_sequence", "generation_constraints"],
      $arch: ["clarity_control", "decomposition_sequence", "reasoning_validation"],
      $sage: ["clarity_control", "generation_constraints", "safety_integrity"],
      $flow: ["decomposition_sequence", "reasoning_validation", "generation_constraints"],
      $vet: ["safety_integrity", "reasoning_validation", "generation_constraints"],
      $vibe: ["clarity_control", "context_and_examples", "generation_constraints"],
      $build: ["decomposition_sequence", "reasoning_validation", "safety_integrity"],
      ralph_execution_core: [
        "decomposition_sequence",
        "generation_constraints",
        "safety_integrity",
      ],
      exported_host_payloads: [
        "generation_constraints",
        "context_and_examples",
        "safety_integrity",
      ],
      active_autonomy_core: [
        "clarity_control",
        "decomposition_sequence",
        "generation_constraints",
        "safety_integrity",
      ],
    },
    role_policy: {
      architect: ["clarity_control", "decomposition_sequence", "reasoning_validation"],
      executor: ["decomposition_sequence", "generation_constraints", "safety_integrity"],
      verifier: ["reasoning_validation", "generation_constraints", "safety_integrity"],
      reviewer: ["reasoning_validation", "safety_integrity", "generation_constraints"],
      worker: ["decomposition_sequence", "generation_constraints", "context_and_examples"],
      writer: ["clarity_control", "context_and_examples", "generation_constraints"],
      designer: ["clarity_control", "context_and_examples", "reasoning_validation"],
    },
    hard_rules: [
      "Prompt Strategy Core is an internal MA policy, not a user-facing skill family.",
      "Prompt techniques cannot override lane ownership, semantic receipts, redaction, or release-state authority.",
      "Prompt techniques cannot weaken AUTO-CONTINUE / ASK rules or permission-handoff bans.",
      "Reasoning techniques may structure internal work, but public artifacts report conclusions, evidence, and verification gaps rather than private deliberation traces.",
      "Few-shot or template examples must be MA-owned and workspace-safe before export.",
      "Safety and prompt-security rules cannot be compressed away by Context Economy Core.",
    ],
  };
}

export function validatePromptStrategyCore(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("prompt strategy core must be an object");
  }
  if (value.schemaVersion !== promptStrategyCoreSchemaVersion) {
    throw new Error(`Unsupported prompt strategy core schemaVersion: ${value.schemaVersion}`);
  }
  if (value.evidence_source?.repo !== "NirDiamant/Prompt_Engineering") {
    throw new Error("prompt strategy core requires the Prompt_Engineering evidence source");
  }
  if (!Array.isArray(value.technique_families) || value.technique_families.length === 0) {
    throw new Error("prompt strategy core requires technique_families");
  }
  if (!value.lane_policy || typeof value.lane_policy !== "object") {
    throw new Error("prompt strategy core requires lane_policy");
  }
  if (!value.role_policy || typeof value.role_policy !== "object") {
    throw new Error("prompt strategy core requires role_policy");
  }
  if (JSON.stringify(value).includes(".omx")) {
    throw new Error("prompt strategy core must not expose OMX runtime paths");
  }
  return value;
}

export function resolvePromptStrategyForSurface({ core, surface, risk = "standard" }) {
  const policy = validatePromptStrategyCore(core);
  const techniques = policy.lane_policy?.[surface] ?? policy.lane_policy?.exported_host_payloads;
  if (!Array.isArray(techniques) || techniques.length === 0) {
    throw new Error(`No prompt strategy policy for surface: ${surface}`);
  }

  const required = new Set(techniques);
  if (["high", "security", "release"].includes(risk)) {
    required.add("safety_integrity");
    required.add("reasoning_validation");
  }

  return {
    record_type: "prompt_strategy_resolution",
    surface,
    risk,
    techniques: [...required],
    evidence_source: policy.evidence_source,
    authority_boundary: {
      may_override_lane_authority: false,
      may_remove_safety_language: false,
      reports_private_reasoning: false,
    },
  };
}

export function resolvePromptStrategyForRole({
  core,
  role,
  surface = "$maestro",
  risk = "standard",
} = {}) {
  const policy = validatePromptStrategyCore(core);
  const roleTechniques = policy.role_policy?.[role] ?? policy.role_policy?.worker;
  if (!Array.isArray(roleTechniques) || roleTechniques.length === 0) {
    throw new Error(`No prompt strategy policy for role: ${role}`);
  }
  const surfaceResolution = resolvePromptStrategyForSurface({ core: policy, surface, risk });
  const techniques = new Set([...surfaceResolution.techniques, ...roleTechniques]);
  if (role === "verifier" || role === "reviewer") {
    techniques.add("reasoning_validation");
    techniques.add("safety_integrity");
  }

  return {
    record_type: "prompt_strategy_role_resolution",
    role,
    surface,
    risk,
    techniques: [...techniques],
    evidence_source: policy.evidence_source,
    authority_boundary: surfaceResolution.authority_boundary,
    output_contract: {
      outcome_first: true,
      evidence_required: ["verifier", "reviewer", "executor"].includes(role),
      private_reasoning_reported: false,
      may_override_lane_authority: false,
    },
  };
}

export async function seedPromptStrategyCoreArtifacts() {
  await ensureDir(getRuntimeSubsystemPath("context"));
  await writeFileIfMissing(
    getPromptStrategyCorePath(),
    `${JSON.stringify(createDefaultPromptStrategyCore(), null, 2)}\n`,
  );
}

export async function loadPromptStrategyCore() {
  return validatePromptStrategyCore(await readJson(getPromptStrategyCorePath()));
}
