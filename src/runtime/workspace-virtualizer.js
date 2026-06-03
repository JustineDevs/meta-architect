import { ensureDir, readJson, writeFileIfMissing } from "../fs-utils.js";
import { getRepoRoot, getRuntimeSubsystemPath } from "../paths.js";

export const workspaceVirtualizerSchemaVersion = "0.1.0";

export function getWorkspaceVirtualizerPath() {
  return getRuntimeSubsystemPath("context", "workspace-virtualizer.json");
}

export function createDefaultWorkspaceVirtualizer() {
  return {
    schemaVersion: workspaceVirtualizerSchemaVersion,
    product: "Meta-Architect",
    purpose:
      "Defines bounded synthetic workspace verification without replacing real source or production release evidence.",
    evidence_boundary: {
      records_as: "virtual_workspace_result",
      never_records_as: "production_evidence",
      production_promotion_requires: ["real_workspace_test", "release_issue_gate_proof"],
    },
    mutation_policy: {
      default: "read_only",
      may_mutate_source: false,
      may_mutate_release_state: false,
    },
    applies_to: ["$build", "executor_roles", "verifier_roles"],
  };
}

export function validateWorkspaceVirtualizer(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("workspace virtualizer must be an object");
  }
  if (value.schemaVersion !== workspaceVirtualizerSchemaVersion) {
    throw new Error(`Unsupported workspace virtualizer schemaVersion: ${value.schemaVersion}`);
  }
  if (value.evidence_boundary?.records_as !== "virtual_workspace_result") {
    throw new Error("workspace virtualizer must record as virtual_workspace_result");
  }
  if (value.evidence_boundary?.never_records_as !== "production_evidence") {
    throw new Error("workspace virtualizer must not record as production_evidence");
  }
  if (value.mutation_policy?.may_mutate_source !== false) {
    throw new Error("workspace virtualizer must not mutate source by default");
  }
  return value;
}

export async function seedWorkspaceVirtualizerArtifacts() {
  await ensureDir(getRuntimeSubsystemPath("context"));
  await writeFileIfMissing(
    getWorkspaceVirtualizerPath(),
    `${JSON.stringify(createDefaultWorkspaceVirtualizer(), null, 2)}\n`,
  );
}

export async function loadWorkspaceVirtualizer() {
  return validateWorkspaceVirtualizer(await readJson(getWorkspaceVirtualizerPath()));
}

export function createVirtualWorkspacePlan({
  commands = [],
  touchpoints = [],
  root = getRepoRoot(),
}) {
  return {
    record_type: "virtual_workspace_result",
    root,
    source_mutation_allowed: false,
    production_evidence: false,
    commands: commands.filter((command) => typeof command === "string" && command.trim()),
    touchpoints: touchpoints.filter((filePath) => typeof filePath === "string" && filePath.trim()),
    required_followup:
      "Run the equivalent checks against the real workspace before production pass.",
  };
}

export function createVirtualVerificationReceipt({ plan, commandResults = [] }) {
  if (plan?.record_type !== "virtual_workspace_result") {
    throw new Error("Virtual verification receipt requires a virtual workspace plan");
  }

  const normalizedResults = commandResults.map((result) => ({
    command: `${result.command ?? ""}`.trim(),
    exitCode: Number.isInteger(result.exitCode) ? result.exitCode : null,
    outputPreview: `${result.outputPreview ?? ""}`.slice(0, 500),
  }));
  const passed =
    normalizedResults.length > 0 &&
    normalizedResults.every((result) => result.command && result.exitCode === 0);

  return {
    record_type: "virtual_verification_receipt",
    records_as: "virtual_workspace_result",
    passed,
    production_evidence: false,
    source_mutation_allowed: false,
    commands: normalizedResults,
    touchpoints: plan.touchpoints,
    required_followup: plan.required_followup,
  };
}
