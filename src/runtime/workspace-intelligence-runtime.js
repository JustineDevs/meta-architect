import { ensureDir, readJson, writeFileIfMissing } from "../fs-utils.js";
import { getRuntimeReadPath, getRuntimeSubsystemPath } from "../paths.js";

export const workspaceIntelligenceSchemaVersion = "0.1.0";

export function getCapabilityCompositionPath() {
  return getRuntimeSubsystemPath("context", "capability-composition.json");
}

export function getWorkspaceContextPackPath() {
  return getRuntimeSubsystemPath("context", "workspace-context-pack.json");
}

export function getWorkspaceEffectivenessPath() {
  return getRuntimeSubsystemPath("context", "workspace-effectiveness.json");
}

export function getSemanticReceiptIndexPath() {
  return getRuntimeReadPath("evidence", "semantic-receipts.json");
}

export function createDefaultCapabilityComposition() {
  return {
    schemaVersion: workspaceIntelligenceSchemaVersion,
    product: "Meta-Architect",
    purpose:
      "Defines how MA default capabilities compose through one workspace runtime instead of becoming redundant skills.",
    capability_matrix: [
      {
        capability: "environment_awareness_core",
        semantic_role: "available_capability_discovery",
        reads: [
          "repo_local_skill_surfaces",
          "repo_local_mcp_configs",
          "plugin_manifests",
          "opt_in_global_user_config",
        ],
        writes: ["environment_capability_index", "available_capability_records"],
        cannot_mutate: [
          "discovered_user_configs",
          ".ma/release.json",
          ".ma/decisions.json",
          "build_evidence",
        ],
        records_as: "available_capability",
        never_records_as: "build_evidence",
        applies_to: [
          "$maestro",
          "all_gated_lanes",
          "all_applicable_agents",
          "all_applicable_roles",
          "team_workers",
          "exported_host_payloads",
        ],
      },
      {
        capability: "helper_orchestration_core",
        semantic_role: "non_gating_helper_support",
        reads: [
          "release_state",
          "runtime_summary",
          "lane_status",
          "workspace_context_pack",
          "manager_run_dispatch_plan",
        ],
        writes: [
          "helper_alignment_receipt",
          "helper_diagnosis_receipt",
          "helper_tdd_receipt",
          "helper_cleanup_receipt",
          "exact_next_trigger",
        ],
        cannot_mutate: [".ma/release.json", ".ma/decisions.json", "gate_approval_status"],
        supports: ["$align", "$diagnose", "$tdd", "$cleanup"],
        records_as: "helper_receipt",
        never_records_as: "gate_approval",
        applies_to: [
          "$maestro",
          "all_gated_lanes",
          "all_applicable_agents",
          "all_applicable_roles",
          "team_workers",
          "exported_host_payloads",
        ],
      },
      {
        capability: "obsidian_integration_core",
        semantic_role: "brain_context",
        reads: [
          "operator_selected_vault_notes",
          "tag_graph",
          "vault_links",
          "exported_ma_snapshots",
        ],
        writes: ["vault_snapshot_exports", "queued_plugin_requests", "note_selection_metadata"],
        cannot_mutate: [".ma/release.json", ".ma/decisions.json", ".ma/plans/", ".ma/specs/"],
        records_as: "vault_context",
        never_records_as: "build_evidence",
        applies_to: ["all_applicable_agents", "all_applicable_roles", "exported_host_payloads"],
      },
      {
        capability: "context_economy_core",
        semantic_role: "context_budget",
        reads: ["progress_updates", "runtime_summaries", "mcp_descriptors", "worker_handoffs"],
        writes: ["terse_summaries", "compressed_artifact_views", "budgeted_tool_descriptions"],
        cannot_mutate: ["code_blocks", "command_output", "warning_semantics", "authority_fields"],
        safety_valves: [
          "security_warning",
          "irreversible_action",
          "user_confusion",
          "verification_failure",
        ],
        applies_to: ["all_applicable_agents", "all_applicable_roles"],
      },
      {
        capability: "prompt_strategy_core",
        semantic_role: "prompt_strategy",
        reads: ["workspace_context_pack", "capability_matrix", "semantic_receipts", "lane_policy"],
        writes: ["prompt_strategy_policy", "lane_prompt_constraints", "host_payload_prompt_rules"],
        cannot_mutate: ["release_state", "lane_authority", "redaction_policy", "semantic_receipts"],
        evidence_source: "NirDiamant/Prompt_Engineering",
        applies_to: ["all_applicable_agents", "all_applicable_roles", "exported_host_payloads"],
      },
      {
        capability: "active_autonomy_core",
        semantic_role: "anti_passive_execution_contract",
        reads: [
          "workspace_contract",
          "prompt_strategy_core",
          "runtime_hook_policy",
          "semantic_receipts",
        ],
        writes: [
          "autonomy_directive",
          "auto_continue_rule",
          "stall_policy",
          "terminal_handoff_contract",
        ],
        cannot_mutate: ["closed_ask_list", "verification_requirements", "safety_boundaries"],
        applies_to: [
          "all_applicable_agents",
          "all_applicable_roles",
          "runtime_hooks",
          "exported_host_payloads",
        ],
      },
      {
        capability: "ralph_execution_core",
        semantic_role: "story_execution",
        reads: ["approved_prd", "test_spec", "semantic_receipts", "workspace_context_pack"],
        writes: ["story_progress", "execution_log", "scoped_learnings"],
        cannot_mutate: [".ma/release.json", "final_build_promotion", "lane_approval_status"],
        authority: "$maestro_or_owning_lane_dispatch",
        applies_to: ["executor_roles", "team_workers", "verifier_followups", "reviewer_followups"],
      },
      {
        capability: "redaction_gateway",
        semantic_role: "provider_boundary",
        reads: ["vault_context", "workspace_context_pack", "provider_bound_prompts"],
        writes: ["sanitized_context", "redaction_receipts"],
        cannot_mutate: ["source_evidence", "release_state", "lane_decisions"],
        applies_to: ["all_provider_bound_agents", "mcp_payloads", "exported_host_payloads"],
      },
      {
        capability: "quorum_review_engine",
        semantic_role: "verification_confidence",
        reads: ["build_plan", "semantic_receipts", "review_votes"],
        writes: ["quorum_verdict", "minority_report", "confidence_receipt"],
        cannot_mutate: ["release_state_without_build_lane", "source_artifacts"],
        applies_to: ["$build", "reviewer_roles", "verifier_roles"],
      },
      {
        capability: "alignment_sentinel",
        semantic_role: "runtime_drift_detection",
        reads: ["release_state", "decisions", "manager_runs", "semantic_receipts"],
        writes: ["drift_report", "bounded_recovery_recommendation"],
        cannot_mutate: ["release_state_without_owning_lane"],
        applies_to: ["$maestro", "owning_lanes", "team_workers"],
      },
      {
        capability: "workspace_virtualizer",
        semantic_role: "bounded_verification_sandbox",
        reads: ["workspace_context_pack", "build_plan", "test_commands"],
        writes: ["virtual_workspace_result", "verification_receipt"],
        cannot_mutate: ["source_workspace_without_explicit_build_lane"],
        applies_to: ["$build", "executor_roles", "verifier_roles"],
      },
      {
        capability: "code_graph_rehearse",
        semantic_role: "trajectory_preview",
        reads: ["code_graph", "workspace_context_pack", "planned_story"],
        writes: ["rehearsal_trace", "risk_receipt", "touchpoint_map"],
        cannot_mutate: ["source_code", "release_state"],
        applies_to: ["$arch", "$flow", "$build", "executor_roles"],
      },
      {
        capability: "skills_registry_export",
        semantic_role: "host_compatibility_payload",
        reads: ["canonical_ma_contracts", "capability_matrix", "workspace_context_pack"],
        writes: ["exported_skill_payloads", "host_install_receipts"],
        cannot_mutate: ["canonical_ma_contracts"],
        applies_to: ["supported_hosts", "package_install", "exported_host_payloads"],
      },
      {
        capability: "universal_plugin_broker_core",
        semantic_role: "cross_agent_plugin_broker",
        reads: [
          "ma_plugin_manifest",
          "plugin_entrypoint",
          "vendor_host_config_roots",
          "skills_registry_export",
        ],
        writes: [
          "isolated_plugin_bundle",
          "executable_plugin_wrapper",
          "vendor_mcp_config_entries",
          "plugin_context_skill_payload",
          "plugin_broker_receipt",
        ],
        cannot_mutate: [
          ".ma/release.json",
          ".ma/decisions.json",
          ".ma/plans/",
          ".ma/specs/",
          "build_evidence",
        ],
        records_as: "plugin_compatibility_configuration",
        never_records_as: "build_evidence",
        applies_to: [
          "claude-code",
          "antigravity",
          "cursor",
          "codex",
          "all_supported_context_layer_agents",
          "exported_host_payloads",
        ],
      },
    ],
    global_rules: [
      "Skills are UI shortcuts over shared runtime contracts, not independent architectures.",
      "Every capability must declare reads, writes, forbidden mutations, semantic role, and applicable surfaces.",
      "Release-state mutation remains lane-owned even when helper roles, workers, or host payloads participate.",
      "Brain context, technical evidence, execution progress, and verification confidence are separate semantic channels.",
    ],
  };
}

export function createDefaultWorkspaceContextPack() {
  return {
    schemaVersion: workspaceIntelligenceSchemaVersion,
    product: "Meta-Architect",
    purpose:
      "Shared workspace context consumed by applicable MA agents, roles, lanes, workers, reviewers, and host exports.",
    workspace_identity: {
      mode: "workspace_intelligence_runtime",
      user_workspace_native: true,
      primary_surface: "$maestro",
      skill_policy: "ui_shortcuts_over_shared_runtime_contracts",
    },
    semantic_channels: {
      brain_context: {
        sources: [".ma/context/project.md", ".ma/memory/notes.md", "obsidian_integration_core"],
        meaning:
          "User notes, project narrative, Obsidian vault context, and durable workspace memory.",
      },
      technical_evidence: {
        sources: [".ma/evidence/", "mcp/servers.json", "$sage"],
        meaning: "Source-backed evidence allowed to support technical and build claims.",
      },
      executable_intent: {
        sources: [".ma/plans/", ".ma/specs/", "ralph_execution_core"],
        meaning: "Approved PRD, test shape, story state, and bounded execution intent.",
      },
      verification_confidence: {
        sources: [
          "$flow",
          "$vet",
          "$vibe",
          "$build",
          "quorum_review_engine",
          "workspace_virtualizer",
        ],
        meaning:
          "Evidence that the current step is safe, testable, and ready to execute or promote.",
      },
      provider_boundary: {
        sources: ["redaction_gateway"],
        meaning: "Controls what workspace or vault context may leave the local runtime.",
      },
      context_budget: {
        sources: ["context_economy_core"],
        meaning:
          "Controls terse summaries without reducing safety, evidence, schemas, or warnings.",
      },
      prompt_strategy: {
        sources: ["prompt_strategy_core", "NirDiamant/Prompt_Engineering"],
        meaning:
          "Selects MA-owned prompt strategies for clarity, decomposition, validation, constraints, context examples, and safety.",
      },
      active_autonomy: {
        sources: ["active_autonomy_core", "runtime_hook_policy", "prompt_strategy_core"],
        meaning:
          "Prevents passive chatbot behavior with AUTO-CONTINUE / ASK rules, completion loops, and hook backstops.",
      },
      helper_support: {
        sources: ["helper_orchestration_core", "$align", "$diagnose", "$tdd", "$cleanup"],
        meaning:
          "Non-gating helper receipts that clarify, diagnose, lock tests, or simplify while returning authority to $maestro or the owning lane.",
      },
      available_capabilities: {
        sources: ["environment_awareness_core"],
        meaning:
          "Existing repo, host, MCP, and plugin capabilities MA may consider when task-relevant without taking ownership or treating them as evidence.",
      },
      plugin_compatibility: {
        sources: ["universal_plugin_broker_core", "skills_registry_export"],
        meaning:
          "Hybrid plugin compatibility: MCP tooling for supported vendors plus MA skill context payloads for all supported host agents.",
      },
    },
    required_workspace_facts: [
      "stack",
      "package_manager",
      "test_commands",
      "build_commands",
      "release_state",
      "trusted_evidence_sources",
      "active_gates",
      "brain_context_sources",
      "redaction_policy",
      "prompt_strategy_policy",
      "active_autonomy_policy",
      "plugin_manifest_policy",
    ],
    applies_to: ["all_applicable_agents", "all_applicable_roles", "exported_host_payloads"],
  };
}

export function createDefaultWorkspaceEffectiveness() {
  const checks = [
    {
      id: "stack_identified",
      proves: "MA can identify the workspace stack before making architectural or build claims.",
      required_for: ["$arch", "$sage", "$build"],
      status: "pending",
    },
    {
      id: "commands_identified",
      proves: "MA can identify test/build commands for bounded verification.",
      required_for: ["$build", "ralph_execution_core", "workspace_virtualizer"],
      status: "pending",
    },
    {
      id: "evidence_channels_bound",
      proves: "MA can separate technical evidence from brain context and generated artifacts.",
      required_for: ["$sage", "$vet", "$build"],
      status: "pending",
    },
    {
      id: "brain_context_bound",
      proves:
        "MA can preserve user/project notes, including Obsidian context, without treating them as build evidence.",
      required_for: ["obsidian_integration_core", "$arch", "$vibe"],
      status: "pending",
    },
    {
      id: "executable_prd_ready",
      proves: "MA can turn approved planning into story-sized execution contracts.",
      required_for: ["ralph_execution_core", "$build"],
      status: "pending",
    },
    {
      id: "environment_awareness_bound",
      proves:
        "MA can discover existing skills, MCP servers, and plugins as available capabilities without auto-running them or turning them into build evidence.",
      required_for: ["$maestro", "all_gated_lanes", "team_workers", "exported_host_payloads"],
      status: "pending",
    },
    {
      id: "helper_support_bound",
      proves:
        "MA can use $align, $diagnose, $tdd, and $cleanup together without creating parallel gates or mutating release state.",
      required_for: ["$maestro", "all_gated_lanes", "team_workers", "exported_host_payloads"],
      status: "pending",
    },
    {
      id: "universal_plugin_broker_bound",
      proves:
        "MA can install a local plugin bundle, generate an MCP wrapper, inject detected vendor configs, and export context-layer skill payloads without claiming build evidence.",
      required_for: ["supported_hosts", "exported_host_payloads", "extensibility"],
      status: "pending",
    },
    {
      id: "semantic_receipts_available",
      proves: "MA can explain what a capability wrote, why it matters, and what it unlocks.",
      required_for: ["all_applicable_agents", "all_applicable_roles"],
      status: "pending",
    },
    {
      id: "prompt_strategy_bound",
      proves:
        "MA can select prompt techniques through first-party lane policy without creating redundant user-facing skills.",
      required_for: ["all_applicable_agents", "all_applicable_roles", "exported_host_payloads"],
      status: "pending",
    },
    {
      id: "active_autonomy_bound",
      proves:
        "MA can continue clear safe work automatically, ask only on a closed risk list, and reject passive permission handoffs.",
      required_for: ["all_applicable_agents", "all_applicable_roles", "runtime_hooks"],
      status: "pending",
    },
  ];
  return {
    schemaVersion: workspaceIntelligenceSchemaVersion,
    product: "Meta-Architect",
    purpose: "Readiness gate for proving MA is effective inside a user workspace.",
    ready: false,
    checks,
    minimum_ready_rule: "All checks must be pass or explicitly waived with owner and reason.",
  };
}

export function createDefaultSemanticReceiptIndex() {
  return {
    schemaVersion: workspaceIntelligenceSchemaVersion,
    product: "Meta-Architect",
    purpose:
      "Semantic receipt registry for explaining capability outputs, provenance, unlocks, and non-unlocks.",
    receipt_schema: {
      semantic_role: "string",
      source: "string",
      claim: "string",
      provenance: ["path_or_url"],
      writes: ["path_or_artifact"],
      unlocks: ["capability_or_gate"],
      does_not_unlock: ["capability_or_gate"],
      authority: "string",
      created_at: "iso_timestamp",
    },
    receipts: [],
  };
}

function validateBaseDocument(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  if (value.schemaVersion !== workspaceIntelligenceSchemaVersion) {
    throw new Error(`Unsupported ${label} schemaVersion: ${value.schemaVersion}`);
  }
  if (JSON.stringify(value).includes(".omx")) {
    throw new Error(`${label} must not expose OMX runtime paths`);
  }
  return value;
}

export function validateCapabilityComposition(value) {
  validateBaseDocument(value, "capability composition");
  if (!Array.isArray(value.capability_matrix) || value.capability_matrix.length === 0) {
    throw new Error("capability composition requires non-empty capability_matrix");
  }
  for (const entry of value.capability_matrix) {
    if (
      typeof entry.capability !== "string" ||
      typeof entry.semantic_role !== "string" ||
      !Array.isArray(entry.reads) ||
      !Array.isArray(entry.writes) ||
      !Array.isArray(entry.cannot_mutate) ||
      !Array.isArray(entry.applies_to)
    ) {
      throw new Error(
        "capability composition entries require capability, semantic_role, reads, writes, cannot_mutate, applies_to",
      );
    }
  }
  const obsidian = value.capability_matrix.find(
    (entry) => entry.capability === "obsidian_integration_core",
  );
  if (obsidian?.records_as !== "vault_context" || obsidian?.never_records_as !== "build_evidence") {
    throw new Error("Obsidian capability must record as vault_context, not build_evidence");
  }
  const helper = value.capability_matrix.find(
    (entry) => entry.capability === "helper_orchestration_core",
  );
  if (helper?.records_as !== "helper_receipt" || helper?.never_records_as !== "gate_approval") {
    throw new Error("Helper orchestration must record helper receipts, not gate approvals");
  }
  const environment = value.capability_matrix.find(
    (entry) => entry.capability === "environment_awareness_core",
  );
  if (
    environment?.records_as !== "available_capability" ||
    environment?.never_records_as !== "build_evidence"
  ) {
    throw new Error("Environment awareness must record available capabilities, not build evidence");
  }
  const broker = value.capability_matrix.find(
    (entry) => entry.capability === "universal_plugin_broker_core",
  );
  if (
    broker?.records_as !== "plugin_compatibility_configuration" ||
    broker?.never_records_as !== "build_evidence"
  ) {
    throw new Error("Universal plugin broker must record compatibility config, not build evidence");
  }
  return value;
}

export function validateWorkspaceContextPack(value) {
  validateBaseDocument(value, "workspace context pack");
  if (!value.semantic_channels || typeof value.semantic_channels !== "object") {
    throw new Error("workspace context pack requires semantic_channels");
  }
  if (
    value.semantic_channels.brain_context?.sources?.includes("obsidian_integration_core") !== true
  ) {
    throw new Error("workspace context pack must include Obsidian as brain_context");
  }
  if (
    value.semantic_channels.helper_support?.sources?.includes("helper_orchestration_core") !== true
  ) {
    throw new Error("workspace context pack must include helper orchestration as helper_support");
  }
  if (
    value.semantic_channels.available_capabilities?.sources?.includes(
      "environment_awareness_core",
    ) !== true
  ) {
    throw new Error("workspace context pack must include environment awareness");
  }
  if (
    value.semantic_channels.plugin_compatibility?.sources?.includes(
      "universal_plugin_broker_core",
    ) !== true
  ) {
    throw new Error("workspace context pack must include universal plugin broker");
  }
  if (
    !Array.isArray(value.required_workspace_facts) ||
    value.required_workspace_facts.length === 0
  ) {
    throw new Error("workspace context pack requires required_workspace_facts");
  }
  return value;
}

export function validateWorkspaceEffectiveness(value) {
  validateBaseDocument(value, "workspace effectiveness");
  if (!Array.isArray(value.checks) || value.checks.length === 0) {
    throw new Error("workspace effectiveness requires checks");
  }
  if (!value.checks.some((check) => check.id === "brain_context_bound")) {
    throw new Error("workspace effectiveness must check brain context binding");
  }
  if (!value.checks.some((check) => check.id === "helper_support_bound")) {
    throw new Error("workspace effectiveness must check helper support binding");
  }
  if (!value.checks.some((check) => check.id === "environment_awareness_bound")) {
    throw new Error("workspace effectiveness must check environment awareness binding");
  }
  if (!value.checks.some((check) => check.id === "universal_plugin_broker_bound")) {
    throw new Error("workspace effectiveness must check universal plugin broker binding");
  }
  return value;
}

export function validateSemanticReceiptIndex(value) {
  validateBaseDocument(value, "semantic receipt index");
  if (!value.receipt_schema || typeof value.receipt_schema !== "object") {
    throw new Error("semantic receipt index requires receipt_schema");
  }
  if (!Array.isArray(value.receipts)) {
    throw new Error("semantic receipt index requires receipts array");
  }
  return value;
}

export function createSemanticReceipt({
  semanticRole,
  source,
  claim,
  provenance = [],
  writes = [],
  unlocks = [],
  doesNotUnlock = [],
  authority = "$maestro_or_owning_lane",
}) {
  if (!semanticRole || !source || !claim) {
    throw new Error("Semantic receipt requires semanticRole, source, and claim");
  }

  return {
    semantic_role: semanticRole,
    source,
    claim,
    provenance: provenance.filter((entry) => typeof entry === "string" && entry.trim()),
    writes: writes.filter((entry) => typeof entry === "string" && entry.trim()),
    unlocks: unlocks.filter((entry) => typeof entry === "string" && entry.trim()),
    does_not_unlock: doesNotUnlock.filter((entry) => typeof entry === "string" && entry.trim()),
    authority,
    created_at: new Date().toISOString(),
  };
}

export function addSemanticReceipt(index, receipt) {
  const next = validateSemanticReceiptIndex({
    ...index,
    receipts: [...index.receipts, receipt],
  });
  return next;
}

export function evaluateWorkspaceEffectiveness(value) {
  const document = validateWorkspaceEffectiveness(value);
  const blockingChecks = document.checks.filter(
    (check) => !["passed", "waived"].includes(check.status),
  );

  return {
    record_type: "workspace_effectiveness_evaluation",
    ready: blockingChecks.length === 0,
    total: document.checks.length,
    passed: document.checks.filter((check) => check.status === "passed").length,
    waived: document.checks.filter((check) => check.status === "waived").length,
    blocking: blockingChecks.map((check) => check.id),
  };
}

export async function seedWorkspaceIntelligenceArtifacts() {
  await Promise.all([
    ensureDir(getRuntimeSubsystemPath("context")),
    ensureDir(getRuntimeReadPath("evidence")),
  ]);
  await Promise.all([
    writeFileIfMissing(
      getCapabilityCompositionPath(),
      `${JSON.stringify(createDefaultCapabilityComposition(), null, 2)}\n`,
    ),
    writeFileIfMissing(
      getWorkspaceContextPackPath(),
      `${JSON.stringify(createDefaultWorkspaceContextPack(), null, 2)}\n`,
    ),
    writeFileIfMissing(
      getWorkspaceEffectivenessPath(),
      `${JSON.stringify(createDefaultWorkspaceEffectiveness(), null, 2)}\n`,
    ),
    writeFileIfMissing(
      getSemanticReceiptIndexPath(),
      `${JSON.stringify(createDefaultSemanticReceiptIndex(), null, 2)}\n`,
    ),
  ]);
}

export async function loadWorkspaceIntelligenceArtifacts() {
  const [
    capabilityComposition,
    workspaceContextPack,
    workspaceEffectiveness,
    semanticReceiptIndex,
  ] = await Promise.all([
    readJson(getCapabilityCompositionPath()).then(validateCapabilityComposition),
    readJson(getWorkspaceContextPackPath()).then(validateWorkspaceContextPack),
    readJson(getWorkspaceEffectivenessPath()).then(validateWorkspaceEffectiveness),
    readJson(getSemanticReceiptIndexPath()).then(validateSemanticReceiptIndex),
  ]);

  return {
    capabilityComposition,
    workspaceContextPack,
    workspaceEffectiveness,
    semanticReceiptIndex,
  };
}
