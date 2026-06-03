import { ensureDir, readJson, writeFileIfMissing } from "../fs-utils.js";
import { getRuntimeSubsystemPath } from "../paths.js";

export const semanticRecordingCoreSchemaVersion = "0.1.0";

export function getSemanticRecordingCorePath() {
  return getRuntimeSubsystemPath("context", "recording-core.json");
}

export function createDefaultSemanticRecordingCore() {
  return {
    schemaVersion: semanticRecordingCoreSchemaVersion,
    product: "Meta-Architect",
    purpose:
      "First-party semantic recording map for MA runtime context, coordination, evidence, memory, and execution artifacts.",
    layers: [
      {
        id: "activity_trace",
        semantic_role: "automatic_runtime_trace",
        mechanism: "runtime_hooks",
        authority: "append_only_hook_layer",
        paths: [".ma/logs/maestro-events.ndjson", ".ma/hooks/audit.log"],
        applies_to: ["$maestro", "gated_lanes", "helper_skills", "team_workers"],
      },
      {
        id: "lifecycle_state",
        semantic_role: "mode_and_run_lifecycle",
        mechanism: "ma_runtime_state_api",
        authority: "leader_or_owning_lane",
        paths: [".ma/state/maestro-state.json", ".ma/state/manager-runs.json"],
        applies_to: ["$maestro", "owning_lanes", "executor_roles", "verifier_roles"],
      },
      {
        id: "brain_context",
        semantic_role: "operator_brain_and_project_context",
        mechanism: "ma_context_memory_api",
        authority: "provenance_marked_context_only",
        paths: [".ma/context/project.md", ".ma/context/recording-core.json", ".ma/memory/notes.md"],
        applies_to: ["all_applicable_agents", "all_applicable_roles"],
      },
      {
        id: "executable_intent",
        semantic_role: "approved_plan_and_test_shape",
        mechanism: "lane_owned_artifacts",
        authority: "owning_lane",
        paths: [".ma/plans/", ".ma/specs/", ".ma/decisions.json"],
        applies_to: ["$arch", "$sage", "$flow", "$vet", "$vibe", "$build", "ralph_execution_core"],
      },
      {
        id: "technical_evidence",
        semantic_role: "build_and_release_evidence",
        mechanism: "evidence_lane_and_mcp_sources",
        authority: "$sage_or_owning_review_lane",
        paths: [".ma/evidence/sources.json", ".ma/evidence/audits.json", "mcp/servers.json"],
        applies_to: ["$sage", "$vet", "$build", "reviewer_roles"],
      },
      {
        id: "coordination_plane",
        semantic_role: "task_claims_mailbox_and_workspace_scope",
        mechanism: "ma_task_workspace_runtime",
        authority: "leader_dispatch_with_worker_proposals",
        paths: [".ma/tasks/", ".ma/workspaces/"],
        applies_to: ["$maestro", "team_workers", "executor_roles", "verifier_roles"],
      },
    ],
    default_core_capabilities: {
      obsidian_integration_core: {
        semantic_role: "brain_context",
        meaning: "Obsidian supplies operator notes, vault graph, and long-lived brain context.",
        records_as: "vault_context",
        never_records_as: "build_evidence",
        authority:
          "Plugin-side actions may queue requests or expose note-selection metadata; authoritative changes return through MA lanes.",
        applies_to: ["all_applicable_agents", "all_applicable_roles", "exported_host_payloads"],
      },
      context_economy_core: {
        semantic_role: "context_budget",
        meaning:
          "MA-owned terse summaries reduce context load while preserving exact technical terms, warnings, schemas, and evidence.",
        safety_valves: [
          "security_warning",
          "irreversible_action",
          "user_confusion",
          "legal_financial_medical_or_high_stakes_guidance",
          "verification_failure",
        ],
        applies_to: [
          "all_applicable_agents",
          "all_applicable_roles",
          "mcp_descriptors",
          "docs_issues_summaries",
        ],
      },
      ralph_execution_core: {
        semantic_role: "story_execution",
        meaning:
          "Executor-capable agents and roles consume the same approved PRD/progress contract after MA gates pass.",
        authority: "$maestro_or_owning_lane_dispatch",
        applies_to: ["executor_roles", "team_workers", "verifier_followups", "reviewer_followups"],
      },
    },
    hard_rules: [
      "MA runtime artifacts use first-party .ma paths and product language.",
      "Obsidian-derived claims are vault_context unless another owning lane explicitly promotes them with evidence.",
      "Context Economy Core cannot remove warnings, schemas, authority fields, verification failures, or known gaps.",
      "Ralph Execution Core cannot bypass $arch -> $sage -> $flow -> $vet -> $vibe -> $build.",
      "Helper roles and workers inherit default-core contracts but do not gain independent release-state authority.",
    ],
  };
}

export function validateSemanticRecordingCore(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("semantic recording core must be an object");
  }
  if (value.schemaVersion !== semanticRecordingCoreSchemaVersion) {
    throw new Error(`Unsupported semantic recording core schemaVersion: ${value.schemaVersion}`);
  }
  if (!Array.isArray(value.layers) || value.layers.length === 0) {
    throw new Error("semantic recording core requires non-empty layers");
  }
  if (!value.default_core_capabilities || typeof value.default_core_capabilities !== "object") {
    throw new Error("semantic recording core requires default_core_capabilities");
  }
  if (
    value.default_core_capabilities.obsidian_integration_core?.records_as !== "vault_context" ||
    value.default_core_capabilities.obsidian_integration_core?.never_records_as !== "build_evidence"
  ) {
    throw new Error("Obsidian Integration Core must record as vault_context, not build_evidence");
  }
  if (JSON.stringify(value).includes(".omx")) {
    throw new Error("semantic recording core must not expose OMX runtime paths");
  }
  return value;
}

export async function seedSemanticRecordingCoreArtifacts() {
  await ensureDir(getRuntimeSubsystemPath("context"));
  await writeFileIfMissing(
    getSemanticRecordingCorePath(),
    `${JSON.stringify(createDefaultSemanticRecordingCore(), null, 2)}\n`,
  );
}

export async function loadSemanticRecordingCore() {
  return validateSemanticRecordingCore(await readJson(getSemanticRecordingCorePath()));
}
