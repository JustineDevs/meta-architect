import fs from "node:fs/promises";
import path from "node:path";
import { writeJson } from "../fs-utils.js";
import { getRuntimeWritePath } from "../paths.js";

export const ralphPrdSchemaVersion = "0.1.0";

export function getRalphPrdPath() {
  return getRuntimeWritePath("plans", "prd.json");
}

export function getRalphProgressPath() {
  return getRuntimeWritePath("plans", "progress.txt");
}

function slugify(value) {
  return `${value}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createRalphPrdContract({
  project = "Meta-Architect-Build",
  branchName = "ralph/meta-architect-build",
  description = "Execute the current bounded Meta-Architect build slice under MA gates.",
  buildSlice = [],
  verificationPlan = [],
  runtimeSummary = null,
}) {
  const safeProject = project.trim() || "Meta-Architect-Build";
  const safeBranch = branchName.trim() || `ralph/${slugify(safeProject)}`;
  const storyDescription =
    buildSlice.length > 0
      ? buildSlice.join(" ")
      : "Implement one reversible, bounded story from the approved MA plan.";
  const acceptanceCriteria = [
    ...verificationPlan,
    "Run the smallest relevant real-workspace verification before marking the story passed.",
    "Preserve Obsidian/vault-derived context as vault_context, not build_evidence.",
    "Preserve Context Economy safety valves for warnings, irreversible actions, failed checks, and known gaps.",
    "Do not mutate .ma/release.json or .ma/decisions.json directly from the execution loop.",
  ].filter((item, index, items) => item && items.indexOf(item) === index);

  return validateRalphPrdContract({
    schemaVersion: ralphPrdSchemaVersion,
    product: "Meta-Architect",
    project: safeProject,
    branchName: safeBranch,
    description,
    authority: "$maestro_or_owning_lane_dispatch",
    evidenceBoundary: {
      obsidianRecordsAs: runtimeSummary?.obsidianRecordsAs ?? "vault_context",
      virtualWorkspaceRecordsAs:
        runtimeSummary?.workspaceVirtualizerRecordsAs ?? "virtual_workspace_result",
      rehearsalRecordsAs: runtimeSummary?.codeGraphRehearseRecordsAs ?? "rehearsal_trace",
      releaseStateMutationAllowed: false,
    },
    qualityGates: ["$arch", "$sage", "$flow", "$vet", "$vibe", "$build"],
    userStories: [
      {
        id: "US-001",
        title: "Execute bounded MA build slice",
        description: storyDescription,
        acceptanceCriteria,
        priority: 1,
        passes: false,
        notes:
          "Ralph Execution Core executes story-by-story after MA gates pass; $build owns final promotion readiness.",
      },
    ],
  });
}

export function validateRalphPrdContract(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Ralph PRD contract must be an object");
  }
  if (value.schemaVersion !== ralphPrdSchemaVersion) {
    throw new Error(`Unsupported Ralph PRD schemaVersion: ${value.schemaVersion}`);
  }
  if (!value.project || !value.branchName || !value.description) {
    throw new Error("Ralph PRD contract requires project, branchName, and description");
  }
  if (value.authority !== "$maestro_or_owning_lane_dispatch") {
    throw new Error("Ralph PRD authority must stay with $maestro or owning lane dispatch");
  }
  if (value.evidenceBoundary?.releaseStateMutationAllowed !== false) {
    throw new Error("Ralph PRD must not allow direct release-state mutation");
  }
  if (value.evidenceBoundary?.obsidianRecordsAs !== "vault_context") {
    throw new Error("Ralph PRD must preserve Obsidian as vault_context");
  }
  if (!Array.isArray(value.userStories) || value.userStories.length === 0) {
    throw new Error("Ralph PRD requires at least one user story");
  }
  for (const story of value.userStories) {
    if (!story.id || !story.title || !story.description) {
      throw new Error("Ralph story requires id, title, and description");
    }
    if (!Array.isArray(story.acceptanceCriteria) || story.acceptanceCriteria.length === 0) {
      throw new Error(`Ralph story ${story.id} requires acceptance criteria`);
    }
    if (story.passes !== false && story.passes !== true) {
      throw new Error(`Ralph story ${story.id} requires boolean passes`);
    }
  }
  return value;
}

export async function writeRalphExecutionContract(options) {
  const prd = createRalphPrdContract(options);
  const prdPath = getRalphPrdPath();
  const progressPath = getRalphProgressPath();
  await writeJson(prdPath, prd);
  await fs.mkdir(path.dirname(progressPath), { recursive: true });
  await fs.writeFile(
    progressPath,
    [
      "# Ralph Execution Progress",
      "",
      `Initialized: ${new Date().toISOString()}`,
      "",
      "## Codebase Patterns",
      "",
      "No reusable execution learnings recorded yet.",
      "",
      "## Iterations",
      "",
      "- pending: US-001 awaits MA-gated execution and fresh verification evidence.",
      "",
    ].join("\n"),
  );
  return { prd, prdPath, progressPath };
}

export function completeRalphStory({ prd, storyId, verificationEvidence = [], notes = "" }) {
  const next = validateRalphPrdContract(JSON.parse(JSON.stringify(prd)));
  if (!Array.isArray(verificationEvidence) || verificationEvidence.length === 0) {
    throw new Error("Ralph story completion requires fresh verification evidence");
  }

  const story = next.userStories.find((candidate) => candidate.id === storyId);
  if (!story) {
    throw new Error(`Ralph story not found: ${storyId}`);
  }

  story.passes = true;
  story.notes = [story.notes, notes, `verification: ${verificationEvidence.join("; ")}`]
    .filter(Boolean)
    .join("\n");
  return validateRalphPrdContract(next);
}

export function selectNextRalphStory({ prd } = {}) {
  const contract = validateRalphPrdContract(prd);
  const candidates = contract.userStories
    .filter((story) => story.passes === false)
    .sort((a, b) => Number(a.priority ?? 999) - Number(b.priority ?? 999));
  return candidates[0] ?? null;
}

export function createRalphIterationPlan({ prd, progress = "", role = "executor" } = {}) {
  const contract = validateRalphPrdContract(prd);
  const story = selectNextRalphStory({ prd: contract });
  if (!story) {
    return {
      record_type: "ralph_iteration_plan",
      status: "complete",
      records_as: "execution_plan",
      build_evidence: false,
      authority: contract.authority,
      next_story: null,
      instruction:
        "All Ralph stories are passed. Return through $maestro or the owning lane with verification evidence.",
    };
  }

  return {
    record_type: "ralph_iteration_plan",
    status: "ready",
    records_as: "execution_plan",
    build_evidence: false,
    authority: contract.authority,
    role,
    next_story: {
      id: story.id,
      title: story.title,
      description: story.description,
      acceptanceCriteria: story.acceptanceCriteria,
      priority: story.priority,
    },
    progress_excerpt: progress.slice(-1200),
    required_gates: contract.qualityGates,
    stop_conditions: [
      "fresh_verification_evidence_missing",
      "destructive_or_irreversible_action_required",
      "credential_or_external_production_authority_missing",
      "same_failure_repeats_three_times",
    ],
    loop_instruction:
      "Execute exactly this story, run real verification, update progress, then mark passes only with fresh evidence.",
  };
}

export function appendRalphProgressEntry({ current = "", storyId, status, evidence = [] }) {
  if (!storyId || !status) {
    throw new Error("Ralph progress entry requires storyId and status");
  }

  return [
    current.trimEnd(),
    `- ${new Date().toISOString()}: ${storyId} ${status}; evidence=${evidence.join(", ") || "none"}`,
    "",
  ].join("\n");
}
