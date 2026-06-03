import { ensureDir, readJson, writeFileIfMissing } from "../fs-utils.js";
import { getRuntimeSubsystemPath } from "../paths.js";

export const activeAutonomyCoreSchemaVersion = "0.1.0";

export function getActiveAutonomyCorePath() {
  return getRuntimeSubsystemPath("context", "active-autonomy-core.json");
}

export function createDefaultActiveAutonomyCore() {
  return {
    schemaVersion: activeAutonomyCoreSchemaVersion,
    product: "Meta-Architect",
    purpose:
      "Canonical MA contract that prevents passive chatbot behavior across prompts, skills, runtime hooks, and contributor rules.",
    autonomy_directive: {
      placement: "top_of_workspace_contract_before_other_guidance",
      text: [
        "YOU ARE AN AUTONOMOUS META-ARCHITECT WORKSPACE AGENT.",
        "EXECUTE CLEAR, SAFE, REVERSIBLE, ALREADY-REQUESTED WORK TO VERIFIED COMPLETION.",
        "DO NOT ASK WHETHER TO PROCEED ON AUTO-CONTINUE BRANCHES.",
        "ASK ONLY FOR DESTRUCTIVE, IRREVERSIBLE, CREDENTIAL-GATED, EXTERNAL-PRODUCTION, OR MATERIALLY SCOPE-CHANGING ACTIONS.",
      ],
    },
    decision_rule: {
      modes: ["AUTO-CONTINUE", "ASK"],
      auto_continue_when: [
        "clear_user_requested_work",
        "local_or_workspace_scoped",
        "low_risk",
        "reversible",
        "non_destructive",
        "verification_path_available",
      ],
      ask_only_when: [
        "destructive_action",
        "irreversible_action",
        "credential_gated_action",
        "external_production_side_effect",
        "material_scope_change",
        "missing_authority_blocks_progress",
      ],
      banned_auto_continue_phrasing: [
        "Should I proceed?",
        "Would you like me to continue?",
        "If you want, I can",
        "If you'd like, I can",
        "Tell me if you want me to",
        "I can continue if you want",
      ],
    },
    completion_loop_contract: {
      required_for: [
        "$maestro",
        "$build",
        "ralph_execution_core",
        "executor_roles",
        "team_workers",
      ],
      stop_conditions: [
        "verified_complete",
        "user_cancelled",
        "closed_ask_condition_requires_user_input",
        "same_blocker_repeated_three_times_with_no_safe_alternative",
      ],
      completion_requires: [
        "fresh_verification_evidence",
        "explicit_outcome",
        "changed_artifacts_or_no_change_reason",
        "known_gaps_or_none",
      ],
      terminal_outcomes: ["finished", "blocked", "failed", "cancelled", "askuserQuestion"],
    },
    runtime_enforcement: {
      hook_layer: "active_autonomy_runtime",
      stall_patterns: [
        "should i proceed",
        "would you like me to continue",
        "if you want, i can",
        "if you'd like, i can",
        "tell me if you want me to",
        "i can continue if you want",
        "let me know if you want me to continue",
      ],
      default_response:
        "AUTO-CONTINUE: continue the current safe branch, execute the next reversible step, then verify before reporting.",
      native_stop_policy: "block_passive_permission_handoff_when_auto_continue_applies",
    },
    contributor_contract: {
      required_surfaces: [
        "workspace_contract",
        "role_prompts",
        "skill_contracts",
        "runtime_hook_policy",
        "docs",
        "tests",
      ],
      regression_targets: [
        "closed_ask_list_present",
        "auto_continue_mode_present",
        "permission_handoff_banned",
        "completion_requires_fresh_evidence",
        "terminal_outcome_required",
        "hook_stall_patterns_present",
      ],
    },
    hard_rules: [
      "Prompt instructions alone are insufficient; runtime hook policy must backstop passive handoffs.",
      "AUTO-CONTINUE branches must state next action or evidence-backed result, not request permission.",
      "ASK branches must name the exact closed-list reason that requires the user.",
      "Completion claims require fresh verification evidence or an explicit validation gap.",
      "Contributor edits must preserve anti-passive prompt patterns and hook policy.",
    ],
  };
}

export function validateActiveAutonomyCore(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("active autonomy core must be an object");
  }
  if (value.schemaVersion !== activeAutonomyCoreSchemaVersion) {
    throw new Error(`Unsupported active autonomy core schemaVersion: ${value.schemaVersion}`);
  }
  if (!value.decision_rule || typeof value.decision_rule !== "object") {
    throw new Error("active autonomy core requires decision_rule");
  }
  if (!value.decision_rule.modes?.includes("AUTO-CONTINUE")) {
    throw new Error("active autonomy core requires AUTO-CONTINUE mode");
  }
  if (!value.decision_rule.modes?.includes("ASK")) {
    throw new Error("active autonomy core requires ASK mode");
  }
  if (
    !Array.isArray(value.decision_rule.ask_only_when) ||
    value.decision_rule.ask_only_when.length === 0
  ) {
    throw new Error("active autonomy core requires closed ask_only_when list");
  }
  if (!value.runtime_enforcement?.stall_patterns?.includes("should i proceed")) {
    throw new Error("active autonomy core requires passive stall pattern coverage");
  }
  if (
    !value.completion_loop_contract?.completion_requires?.includes("fresh_verification_evidence")
  ) {
    throw new Error("active autonomy core requires fresh verification evidence");
  }
  if (JSON.stringify(value).includes(".omx")) {
    throw new Error("active autonomy core must not expose OMX runtime paths");
  }
  return value;
}

export function classifyAutonomyBranch({ core, requested = true, riskSignals = [] }) {
  const policy = validateActiveAutonomyCore(core);
  const signals = new Set(riskSignals.map((signal) => `${signal}`.toLowerCase()));
  const askReason = policy.decision_rule.ask_only_when.find((reason) =>
    signals.has(reason.toLowerCase()),
  );

  if (!requested) {
    return {
      mode: "ASK",
      reason: "missing_authority_blocks_progress",
      permission_handoff_allowed: true,
    };
  }

  if (askReason) {
    return {
      mode: "ASK",
      reason: askReason,
      permission_handoff_allowed: true,
    };
  }

  return {
    mode: "AUTO-CONTINUE",
    reason: "clear_safe_reversible_requested_work",
    permission_handoff_allowed: false,
    next_action_contract:
      "state the next safe action or evidence-backed result; do not ask whether to proceed",
  };
}

export function detectPassivePermissionHandoff(text, core = createDefaultActiveAutonomyCore()) {
  const policy = validateActiveAutonomyCore(core);
  const normalized = `${text}`.toLowerCase();
  return policy.decision_rule.banned_auto_continue_phrasing.some((phrase) =>
    normalized.includes(
      phrase
        .toLowerCase()
        .replace(/\.\.\.$/, "")
        .trim(),
    ),
  );
}

export async function seedActiveAutonomyCoreArtifacts() {
  await ensureDir(getRuntimeSubsystemPath("context"));
  await writeFileIfMissing(
    getActiveAutonomyCorePath(),
    `${JSON.stringify(createDefaultActiveAutonomyCore(), null, 2)}\n`,
  );
}

export async function loadActiveAutonomyCore() {
  return validateActiveAutonomyCore(await readJson(getActiveAutonomyCorePath()));
}
