import fs from "node:fs/promises";
import path from "node:path";
import { ensureDir, writeFileIfMissing } from "./fs-utils.js";
import { getRuntimeWritePath } from "./paths.js";

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
    "- `.ma/runbook.md` defines the local operator workflow",
    "",
    "## Next Recommended Trigger",
    "",
    idea ? "`$arch`" : "`ma idea`",
    "",
  ].join("\n");
}

function renderArchitectureSpec({ idea, blueprint }) {
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
    "## Next Recommended Trigger",
    "",
    "`$sage`",
    "",
  ].join("\n");
}

function renderEvidenceSpec({ idea, sourceEntries, verified, blockers }) {
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

  lines.push("## Next Recommended Trigger", "", verified ? "`$flow`" : "`$sage`", "");
  return lines.join("\n");
}

function renderLogicSpec(logicMap) {
  return [
    "# Logic Spec",
    "",
    `Updated: ${new Date().toISOString()}`,
    "",
    "## States",
    "",
    ...logicMap.states.map((state) => `- ${state}`),
    "",
    "## Blockers",
    "",
    ...(logicMap.blockers.length === 0 ? ["None."] : logicMap.blockers.map((item) => `- ${item}`)),
    "",
    "## Next Recommended Trigger",
    "",
    "`$vet`",
    "",
  ].join("\n");
}

function renderSecuritySpec({ finding, auditCount, cveCount }) {
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
    "## Next Recommended Trigger",
    "",
    "`$vibe`",
    "",
  ].join("\n");
}

function renderExperienceSpec({ note, outcomeCount }) {
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
    "## Next Recommended Trigger",
    "",
    "`$build`",
    "",
  ].join("\n");
}

function renderImplementationPlan({ idea, blueprint }) {
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
  ].join("\n");
}

function renderBuildPlan({ allowed, blockers, nextTriggers, suggestedBranches = [] }) {
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
    "This runbook defines the local helper-path workflow for Meta-Architect.",
    "",
    "## Canonical Sequence",
    "",
    "1. `ma setup`",
    '2. `ma idea "..."`',
    "3. `ma run '$arch'`",
    "4. `ma run '$sage'`",
    "5. `ma run '$flow'`",
    "6. `ma run '$vet'`",
    "7. `ma run '$vibe'`",
    "8. `ma status`",
    "9. `ma run '$build'`",
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

export async function writeArchitectureArtifacts({ idea, blueprint }) {
  await writeArtifact("specs/architecture.md", renderArchitectureSpec({ idea, blueprint }));
  await writeArtifact("plans/implementation.md", renderImplementationPlan({ idea, blueprint }));
}

export async function writeEvidenceSpec({ idea, sourceEntries, verified, blockers }) {
  await writeArtifact(
    "specs/evidence.md",
    renderEvidenceSpec({ idea, sourceEntries, verified, blockers }),
  );
}

export async function writeLogicSpec(logicMap) {
  await writeArtifact("specs/logic.md", renderLogicSpec(logicMap));
}

export async function writeSecuritySpec({ finding, auditCount, cveCount }) {
  await writeArtifact("specs/security.md", renderSecuritySpec({ finding, auditCount, cveCount }));
}

export async function writeExperienceSpec({ note, outcomeCount }) {
  await writeArtifact("specs/experience.md", renderExperienceSpec({ note, outcomeCount }));
}

export async function writeBuildPlanArtifact({
  allowed,
  blockers,
  nextTriggers,
  suggestedBranches = [],
}) {
  await writeArtifact(
    "plans/build.md",
    renderBuildPlan({ allowed, blockers, nextTriggers, suggestedBranches }),
  );
}
