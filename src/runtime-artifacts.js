import fs from "node:fs/promises";
import path from "node:path";
import { ensureDir, writeFileIfMissing } from "./fs-utils.js";
import { getRuntimeWritePath } from "./paths.js";
import { ensureRuntimeSubsystems } from "./runtime/runtime-state.js";

const runtimeDirs = ["context", "specs", "plans"];

function renderProjectContext({ idea = null }) {
  return [
    "# Project Context",
    "",
    `Updated: ${new Date().toISOString()}`,
    "",
    "## Current Brief",
    "",
    idea ?? 'No project brief captured yet. Run `ma idea "..."` first.',
    "",
    "## Source Of Truth",
    "",
    "- `.ma/decisions.json` tracks gate and decision history",
    "- `.ma/release.json` tracks release-state fields",
    "- `.ma/runbook.md` defines the local helper workflow",
    "",
    "## Next Recommended Trigger",
    "",
    idea ? "`$maestro`" : "`ma idea`",
    "",
  ].join("\n");
}

function renderRuntimeSummary(summary) {
  if (!summary) {
    return [];
  }

  return [
    "## Runtime Context",
    "",
    `- guidance sources: ${summary.guidanceSourceCount}`,
    `- guidance include roots: ${summary.guidanceIncludeRoots}`,
    `- continuity sessions: ${summary.continuitySessionCount}`,
    `- continuity notes present: ${summary.continuityHasNotes}`,
    `- compatibility hooks: ${summary.compatibilityHookCount}`,
    `- runtime hook events: ${summary.runtimeHookCount}`,
    `- configured runtime hooks: ${summary.configuredRuntimeHookCount}`,
    `- workers: ${summary.workerCount}`,
    `- tasks: ${summary.taskCount}`,
    `- pending mailbox proposals: ${summary.pendingMailboxCount}`,
    `- workspaces: ${summary.workspaceCount}`,
    `- recorded decisions: ${summary.decisionCount}`,
    `- manager runs: ${summary.managerRunCount}`,
    `- active manager runs: ${summary.activeManagerRunCount}`,
    `- waiting-review manager runs: ${summary.waitingReviewManagerRunCount}`,
    `- build status: ${summary.buildStatus}`,
    `- missing runtime artifacts: ${summary.missingArtifacts.length}`,
    `- invalid runtime artifacts: ${summary.invalidArtifacts.length}`,
    "",
  ];
}

function formatManagerHelper(helper) {
  return `${helper.skill}: ${helper.objective} [${helper.status}]`;
}

function formatManagerGate(gate) {
  return `${gate.skill}: ${gate.objective} [${gate.status}]`;
}

function renderManagerSection(managerRun) {
  if (!managerRun) {
    return [];
  }

  const lines = [
    "## Manager Run",
    "",
    `- id: ${managerRun.id}`,
    `- state: ${managerRun.state}`,
    `- mode: ${managerRun.mode}`,
    `- next action: ${managerRun.nextAction}`,
  ];

  if (managerRun.dispatchPlan.helpers.length > 0) {
    lines.push("- helper dispatch:");
    lines.push(
      ...managerRun.dispatchPlan.helpers.map((item) => `  - ${formatManagerHelper(item)}`),
    );
  }

  if (managerRun.dispatchPlan.gated.length > 0) {
    lines.push("- gated dispatch:");
    lines.push(...managerRun.dispatchPlan.gated.map((item) => `  - ${formatManagerGate(item)}`));
  }

  if (managerRun.dispatchPlan.team) {
    lines.push("- team dispatch:");
    lines.push(`  - title: ${managerRun.dispatchPlan.team.title}`);
    lines.push(`  - objective: ${managerRun.dispatchPlan.team.objective}`);
    if (managerRun.dispatchPlan.team.createdTaskIds.length > 0) {
      lines.push(`  - created tasks: ${managerRun.dispatchPlan.team.createdTaskIds.join(", ")}`);
    }
  }

  if (managerRun.pendingReview.proposalPath) {
    lines.push(`- pending review: ${managerRun.pendingReview.proposalPath}`);
  }

  lines.push("");
  return lines;
}

function renderArchitectureSpec({ idea, blueprint, runtimeSummary }) {
  return [
    "# Architecture Spec",
    "",
    `Updated: ${new Date().toISOString()}`,
    "",
    "## Problem Statement",
    "",
    idea,
    "",
    "## Blueprint Summary",
    "",
    blueprint.summary,
    "",
    "## Suggested Stack",
    "",
    ...blueprint.suggestedStack.map((item) => `- ${item}`),
    "",
    "## Intended Outcome",
    "",
    blueprint.outcome,
    "",
    ...renderRuntimeSummary(runtimeSummary),
    "## Next Recommended Trigger",
    "",
    "`$sage`",
    "",
  ].join("\n");
}

function renderEvidenceSpec({ idea, sourceEntries, verified, blockers, runtimeSummary }) {
  const status = verified ? "VERIFIED" : sourceEntries.length > 0 ? "PARTIAL" : "MISSING";
  const lines = [
    "# Evidence Spec",
    "",
    `Updated: ${new Date().toISOString()}`,
    "",
    "## Probe Basis",
    "",
    idea,
    "",
    "## Evidence Status",
    "",
    status,
    "",
    "## Sources",
    "",
  ];

  if (sourceEntries.length === 0) {
    lines.push("No approved GitMCP sources configured.", "");
  } else {
    for (const source of sourceEntries) {
      lines.push(`- ${source.repo} (${source.category})`);
      lines.push(`  - endpoint: ${source.endpoint}`);
      if (source.liveProbe?.sampleText) {
        lines.push(`  - live probe: ${source.liveProbe.sampleText}`);
      } else if (source.liveProbe?.reason) {
        lines.push(`  - live probe: ${source.liveProbe.reason}`);
      } else if (source.liveProbe?.error) {
        lines.push(`  - live probe error: ${source.liveProbe.error}`);
      }
    }
    lines.push("");
  }

  lines.push("## Blockers", "");
  if (blockers.length === 0) {
    lines.push("None.", "");
  } else {
    lines.push(...blockers.map((blocker) => `- ${blocker}`), "");
  }

  lines.push(...renderRuntimeSummary(runtimeSummary));
  lines.push("## Next Recommended Trigger", "", verified ? "`$flow`" : "`$sage`", "");
  return lines.join("\n");
}

function renderLogicSpec(logicMap) {
  return [
    "# Logic Spec",
    "",
    `Updated: ${new Date().toISOString()}`,
    "",
    ...(logicMap.actors
      ? ["## Actors", "", ...logicMap.actors.map((actor) => `- ${actor}`), ""]
      : []),
    "## States",
    "",
    ...logicMap.states.map((state) => `- ${state}`),
    "",
    ...(logicMap.runtimeSummary ? renderRuntimeSummary(logicMap.runtimeSummary) : []),
    "## Blockers",
    "",
    ...(logicMap.blockers.length === 0 ? ["None."] : logicMap.blockers.map((item) => `- ${item}`)),
    "",
    "## Next Recommended Trigger",
    "",
    logicMap.nextTrigger ?? "`$vet`",
    "",
  ].join("\n");
}

function renderSecuritySpec({
  finding,
  auditCount,
  cveCount,
  runtimeSummary,
  nextTrigger = "`$vibe`",
}) {
  return [
    "# Security Spec",
    "",
    `Updated: ${new Date().toISOString()}`,
    "",
    "## Latest Finding",
    "",
    `- severity: ${finding.severity}`,
    `- summary: ${finding.summary}`,
    `- unresolved: ${finding.unresolved}`,
    "",
    "## Evidence Files",
    "",
    `- audits logged: ${auditCount}`,
    `- cve entries logged: ${cveCount}`,
    "",
    ...renderRuntimeSummary(runtimeSummary),
    "## Next Recommended Trigger",
    "",
    nextTrigger,
    "",
  ].join("\n");
}

function renderExperienceSpec({ note, outcomeCount, runtimeSummary, nextTrigger = "`$build`" }) {
  return [
    "# Experience Spec",
    "",
    `Updated: ${new Date().toISOString()}`,
    "",
    "## Latest Outcome",
    "",
    `- area: ${note.area}`,
    `- summary: ${note.summary}`,
    "",
    "## Evidence Files",
    "",
    `- outcomes logged: ${outcomeCount}`,
    "",
    ...renderRuntimeSummary(runtimeSummary),
    "## Next Recommended Trigger",
    "",
    nextTrigger,
    "",
  ].join("\n");
}

function renderImplementationPlan({ idea, blueprint, runtimeSummary }) {
  return [
    "# Implementation Plan",
    "",
    `Updated: ${new Date().toISOString()}`,
    "",
    "## Goal",
    "",
    idea,
    "",
    "## Planned Phases",
    "",
    "- Capture the approved architecture baseline",
    "- Validate evidence through approved GitMCP sources",
    "- Validate logic and state transitions",
    "- Review security and experience gates",
    "- Unlock bounded build execution",
    "",
    "## Architecture Anchor",
    "",
    blueprint.summary,
    "",
    ...renderRuntimeSummary(runtimeSummary),
  ].join("\n");
}

function renderMaestroPlan({
  releaseState,
  recommendation,
  runtimeSummary,
  workflowSequence,
  managerRun = null,
}) {
  return [
    "# Maestro Plan",
    "",
    `Updated: ${new Date().toISOString()}`,
    "",
    "## Current Gate State",
    "",
    `- idea: ${releaseState.idea_status}`,
    `- architecture: ${releaseState.architecture_status}`,
    `- evidence: ${releaseState.evidence_status}`,
    `- logic: ${releaseState.logic_status}`,
    `- security: ${releaseState.security_status}`,
    `- experience: ${releaseState.experience_status}`,
    `- build: ${releaseState.build_status}`,
    "",
    "## Best Next Step",
    "",
    recommendation.nextStep,
    "",
    "## Why This Is Next",
    "",
    recommendation.why,
    "",
    ...renderManagerSection(managerRun),
    "## Workflow Sequence",
    "",
    ...workflowSequence.map((trigger) => `- ${trigger}`),
    "",
    ...renderRuntimeSummary(runtimeSummary),
    "## Recommended Lane",
    "",
    `- primary: ${recommendation.primaryLane}`,
    `- support: ${recommendation.supportLane}`,
    "",
    "## Suggested Assignment",
    "",
    ...recommendation.assignments.map((item) => `- ${item}`),
    "",
    "## Avoid For Now",
    "",
    ...recommendation.avoid.map((item) => `- ${item}`),
    "",
    "## Exact Next Trigger",
    "",
    recommendation.nextTrigger,
    "",
  ].join("\n");
}

function renderBuildPlan({
  allowed,
  blockers,
  nextTriggers,
  suggestedBranches = [],
  runtimeSummary = null,
}) {
  const lines = [
    "# Build Plan",
    "",
    `Updated: ${new Date().toISOString()}`,
    "",
    "## Gate State",
    "",
    allowed ? "READY" : "LOCKED",
    "",
    "## Blockers",
    "",
  ];

  if (blockers.length === 0) {
    lines.push("None.", "");
  } else {
    lines.push(...blockers.map((blocker) => `- ${blocker}`), "");
  }

  lines.push(...renderRuntimeSummary(runtimeSummary));

  lines.push("## Next Allowed Triggers", "");
  lines.push(
    ...(nextTriggers.length === 0 ? ["- $build"] : nextTriggers.map((item) => `- ${item}`)),
    "",
  );

  if (suggestedBranches.length > 0) {
    lines.push(
      "## Suggested Branches",
      "",
      ...suggestedBranches.map((branch) => `- ${branch}`),
      "",
    );
  }

  return lines.join("\n");
}

function renderRunbook() {
  return [
    "# Meta-Architect Runbook",
    "",
    "## Purpose",
    "",
    "This runbook defines the local helper-path workflow that supports the primary in-session skill flow.",
    "",
    "## Canonical Sequence",
    "",
    "1. `ma setup`",
    '2. `ma idea "..."`',
    "3. `ma run '$maestro'`",
    "4. follow the exact next trigger from `.ma/plans/maestro.md`",
    "5. return to `$maestro` whenever the next lane is unclear",
    "6. `ma status`",
    "",
    "## Runtime Artifacts",
    "",
    "- `.ma/context/project.md`",
    "- `.ma/specs/architecture.md`",
    "- `.ma/specs/evidence.md`",
    "- `.ma/specs/logic.md`",
    "- `.ma/specs/security.md`",
    "- `.ma/specs/experience.md`",
    "- `.ma/plans/implementation.md`",
    "- `.ma/plans/build.md`",
    "- `.ma/decisions.json`",
    "- `.ma/release.json`",
    "",
    "## Guardrails",
    "",
    "- Do not edit gate status files manually.",
    "- Treat GitHub release state and npm registry state as separate facts.",
    "- Do not claim a publish channel succeeded without evidence from that channel.",
    "",
  ].join("\n");
}

async function writeArtifact(relativePath, content) {
  const target = getRuntimeWritePath(...relativePath.split("/"));
  await ensureDir(path.dirname(target));
  await fs.writeFile(target, `${content.trimEnd()}\n`);
}

export async function seedRuntimeArtifacts() {
  for (const dir of runtimeDirs) {
    await ensureDir(getRuntimeWritePath(dir));
  }
  await ensureRuntimeSubsystems();

  await writeFileIfMissing(
    getRuntimeWritePath("context", "project.md"),
    `${renderProjectContext({})}\n`,
  );
  await writeFileIfMissing(
    getRuntimeWritePath("specs", "architecture.md"),
    "# Architecture Spec\n\nNo architecture captured yet.\n",
  );
  await writeFileIfMissing(
    getRuntimeWritePath("specs", "evidence.md"),
    "# Evidence Spec\n\nNo evidence captured yet.\n",
  );
  await writeFileIfMissing(
    getRuntimeWritePath("specs", "logic.md"),
    "# Logic Spec\n\nNo logic review captured yet.\n",
  );
  await writeFileIfMissing(
    getRuntimeWritePath("specs", "security.md"),
    "# Security Spec\n\nNo security review captured yet.\n",
  );
  await writeFileIfMissing(
    getRuntimeWritePath("specs", "experience.md"),
    "# Experience Spec\n\nNo experience review captured yet.\n",
  );
  await writeFileIfMissing(
    getRuntimeWritePath("plans", "implementation.md"),
    "# Implementation Plan\n\nNo implementation plan captured yet.\n",
  );
  await writeFileIfMissing(
    getRuntimeWritePath("plans", "build.md"),
    "# Build Plan\n\nBuild is still locked.\n",
  );
  await writeFileIfMissing(getRuntimeWritePath("runbook.md"), `${renderRunbook()}\n`);
}

export async function writeProjectContext(idea) {
  await writeArtifact("context/project.md", renderProjectContext({ idea }));
}

export async function writeArchitectureArtifacts({ idea, blueprint, runtimeSummary = null }) {
  await writeArtifact(
    "specs/architecture.md",
    renderArchitectureSpec({ idea, blueprint, runtimeSummary }),
  );
  await writeArtifact(
    "plans/implementation.md",
    renderImplementationPlan({ idea, blueprint, runtimeSummary }),
  );
}

export async function writeEvidenceSpec({
  idea,
  sourceEntries,
  verified,
  blockers,
  runtimeSummary = null,
}) {
  await writeArtifact(
    "specs/evidence.md",
    renderEvidenceSpec({ idea, sourceEntries, verified, blockers, runtimeSummary }),
  );
}

export async function writeLogicSpec(logicMap) {
  await writeArtifact("specs/logic.md", renderLogicSpec(logicMap));
}

export async function writeSecuritySpec({
  finding,
  auditCount,
  cveCount,
  runtimeSummary = null,
  nextTrigger = "`$vibe`",
}) {
  await writeArtifact(
    "specs/security.md",
    renderSecuritySpec({ finding, auditCount, cveCount, runtimeSummary, nextTrigger }),
  );
}

export async function writeExperienceSpec({
  note,
  outcomeCount,
  runtimeSummary = null,
  nextTrigger = "`$build`",
}) {
  await writeArtifact(
    "specs/experience.md",
    renderExperienceSpec({ note, outcomeCount, runtimeSummary, nextTrigger }),
  );
}

export async function writeBuildPlanArtifact({
  allowed,
  blockers,
  nextTriggers,
  suggestedBranches = [],
  runtimeSummary = null,
}) {
  await writeArtifact(
    "plans/build.md",
    renderBuildPlan({ allowed, blockers, nextTriggers, suggestedBranches, runtimeSummary }),
  );
}

export async function writeMaestroPlan({
  releaseState,
  recommendation,
  runtimeSummary = null,
  workflowSequence = [],
  managerRun = null,
}) {
  await writeArtifact(
    "plans/maestro.md",
    renderMaestroPlan({
      releaseState,
      recommendation,
      runtimeSummary,
      workflowSequence,
      managerRun,
    }),
  );
}
