import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { createTempRepo } from "./helpers/temp-repo.js";

const repoRoot = process.cwd();
const cleanDecisions = {
  schemaVersion: "0.1.0",
  idea_status: "DRAFT",
  architecture_status: "DRAFT",
  evidence_status: "MISSING",
  logic_status: "PENDING",
  security_status: "PENDING",
  experience_status: "PENDING",
  build_status: "LOCKED",
  merge_status: "LOCKED",
  release_status: "LOCKED",
  decisions: [],
};
const cleanRelease = {
  schemaVersion: "0.1.0",
  idea_status: "DRAFT",
  architecture_status: "DRAFT",
  evidence_status: "MISSING",
  logic_status: "PENDING",
  security_status: "PENDING",
  experience_status: "PENDING",
  build_status: "LOCKED",
  merge_status: "LOCKED",
  release_status: "LOCKED",
  waiver: null,
  updatedAt: "2026-04-30T00:00:00.000Z",
};
const realisticReleaseHardeningIdea =
  "Harden Meta-Architect v0.1.13 semantic core with Obsidian vault context, Ralph execution proof, context economy, and package-gated release evidence";

test("maestro advances one bounded manager action per call until review gates block it", async () => {
  const tempRoot = await createTempRepo("meta-architect-flow-", repoRoot);
  await fs.mkdir(path.join(tempRoot, ".ma"), { recursive: true });
  await fs.writeFile(
    path.join(tempRoot, ".ma", "decisions.json"),
    `${JSON.stringify(cleanDecisions, null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(tempRoot, ".ma", "release.json"),
    `${JSON.stringify(cleanRelease, null, 2)}\n`,
  );

  const previousRoot = process.env.MA_ROOT;
  const previousLive = process.env.MA_DISABLE_LIVE_MCP;
  process.env.MA_ROOT = tempRoot;
  process.env.MA_DISABLE_LIVE_MCP = "1";

  const { listSkills, runInit, runIdea, runMaestro } = await import(
    `${pathToFileURL(path.join(repoRoot, "src", "skills.js")).href}?t=${Date.now()}`
  );
  const { loadReleaseState } = await import(
    `${pathToFileURL(path.join(repoRoot, "src", "release-state.js")).href}?t=${Date.now()}`
  );
  const { evaluateBuildGate } = await import(
    `${pathToFileURL(path.join(repoRoot, "src", "build-gate.js")).href}?t=${Date.now()}`
  );

  await runInit();
  await runIdea(realisticReleaseHardeningIdea);
  await runMaestro();
  await runMaestro();

  const releaseState = await loadReleaseState();
  assert.equal(releaseState.idea_status, "CLEAR");
  assert.equal(releaseState.architecture_status, "APPROVED");
  assert.equal(releaseState.evidence_status, "PARTIAL");
  assert.equal(releaseState.logic_status, "PENDING");
  assert.equal(releaseState.security_status, "PENDING");
  assert.equal(releaseState.experience_status, "PENDING");
  assert.equal(evaluateBuildGate(releaseState).allowed, false);

  const projectContext = await fs.readFile(
    path.join(tempRoot, ".ma", "context", "project.md"),
    "utf8",
  );
  const architectureSpec = await fs.readFile(
    path.join(tempRoot, ".ma", "specs", "architecture.md"),
    "utf8",
  );
  const evidenceSpec = await fs.readFile(
    path.join(tempRoot, ".ma", "specs", "evidence.md"),
    "utf8",
  );
  const implementationPlan = await fs.readFile(
    path.join(tempRoot, ".ma", "plans", "implementation.md"),
    "utf8",
  );
  const maestroPlan = await fs.readFile(path.join(tempRoot, ".ma", "plans", "maestro.md"), "utf8");
  const skillArtifacts = await fs.readdir(path.join(tempRoot, ".ma", "skills"));
  const guidanceIndex = JSON.parse(
    await fs.readFile(path.join(tempRoot, ".ma", "guidance", "merged.json"), "utf8"),
  );
  const taskRegistry = JSON.parse(
    await fs.readFile(path.join(tempRoot, ".ma", "tasks", "registry.json"), "utf8"),
  );
  const maestroState = JSON.parse(
    await fs.readFile(path.join(tempRoot, ".ma", "state", "maestro-state.json"), "utf8"),
  );
  const maestroEvents = (
    await fs.readFile(path.join(tempRoot, ".ma", "logs", "maestro-events.ndjson"), "utf8")
  )
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  assert.match(projectContext, /Harden Meta-Architect v0\.1\.13 semantic core/);
  assert.deepEqual(listSkills(), [
    "$maestro",
    "$arch",
    "$sage",
    "$flow",
    "$vet",
    "$vibe",
    "$build",
    "$align",
    "$diagnose",
    "$tdd",
    "$cleanup",
  ]);
  assert.equal(skillArtifacts.includes("maestro.skill.md"), true);
  assert.equal(skillArtifacts.includes("meta-architect.skill.md"), false);
  assert.match(maestroPlan, /\$arch/);
  assert.doesNotMatch(maestroPlan, /\$meta-architect/);
  assert.match(architectureSpec, /## Decision/);
  assert.match(architectureSpec, /## Rejected Alternatives/);
  assert.match(evidenceSpec, /## Evidence Grade/);
  assert.match(evidenceSpec, /## Exact Upstream Mapping/);
  assert.match(
    architectureSpec,
    /Blueprint derived from idea: Harden Meta-Architect v0\.1\.13 semantic core/,
  );
  assert.match(implementationPlan, /Validate evidence through approved GitMCP sources/);
  assert.match(architectureSpec, /## Runtime Context/);
  assert.match(maestroPlan, /## Runtime Context/);
  assert.equal(guidanceIndex.sources.length, 1);
  assert.equal(guidanceIndex.sources[0].id, "ponytail");
  assert.match(guidanceIndex.content, /minimal-diff/);
  assert.match(architectureSpec, /Minimal-diff bias/);
  assert.deepEqual(taskRegistry.tasks, []);
  assert.equal(typeof maestroState.runtime_tracks.track_arch_sync, "object");
  assert.equal(
    maestroEvents.some(
      (event) => event.record_type === "runtime:track_status" && event.gate === "$arch",
    ),
    true,
  );

  if (previousRoot === undefined) {
    delete process.env.MA_ROOT;
  } else {
    process.env.MA_ROOT = previousRoot;
  }

  if (previousLive === undefined) {
    delete process.env.MA_DISABLE_LIVE_MCP;
  } else {
    process.env.MA_DISABLE_LIVE_MCP = previousLive;
  }
});

test("maestro persists a manager-run artifact with lifecycle and dispatch metadata", async () => {
  const tempRoot = await createTempRepo("meta-architect-maestro-helper-", repoRoot);
  await fs.mkdir(path.join(tempRoot, ".ma"), { recursive: true });
  await fs.writeFile(
    path.join(tempRoot, ".ma", "decisions.json"),
    `${JSON.stringify(cleanDecisions, null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(tempRoot, ".ma", "release.json"),
    `${JSON.stringify(cleanRelease, null, 2)}\n`,
  );

  const previousRoot = process.env.MA_ROOT;
  process.env.MA_ROOT = tempRoot;

  try {
    const { runInit, runMaestro } = await import(
      `${pathToFileURL(path.join(repoRoot, "src", "skills.js")).href}?t=${Date.now()}`
    );
    const { loadReleaseState } = await import(
      `${pathToFileURL(path.join(repoRoot, "src", "release-state.js")).href}?t=${Date.now()}`
    );

    await runInit();
    await fs.writeFile(
      path.join(tempRoot, "mcp", "servers.json"),
      `${JSON.stringify(
        {
          schemaVersion: "0.1.0",
          servers: [
            {
              kind: "gitmcp-evidence",
              category: "meta-list",
              repo: "sindresorhus/awesome",
              endpoint: "https://gitmcp.io/sindresorhus/awesome",
            },
          ],
        },
        null,
        2,
      )}\n`,
    );
    const { runIdea } = await import(
      `${pathToFileURL(path.join(repoRoot, "src", "skills.js")).href}?t=${Date.now()}`
    );
    await runIdea("Build an autonomous manager verification flow");
    await runMaestro();

    const releaseState = await loadReleaseState();
    const managerRuns = JSON.parse(
      await fs.readFile(path.join(tempRoot, ".ma", "state", "manager-runs.json"), "utf8"),
    );
    const maestroState = JSON.parse(
      await fs.readFile(path.join(tempRoot, ".ma", "state", "maestro-state.json"), "utf8"),
    );
    const latestRun = managerRuns.runs.at(-1);

    assert.equal(releaseState.architecture_status, "APPROVED");
    assert.equal(managerRuns.schemaVersion, "0.1.0");
    assert.equal(typeof latestRun.id, "string");
    assert.equal(latestRun.triggeredBy, "$maestro");
    assert.equal(typeof latestRun.mode, "string");
    assert.equal(typeof latestRun.state, "string");
    assert.equal(typeof latestRun.nextAction, "string");
    assert.equal(Array.isArray(latestRun.dispatchPlan.helpers), true);
    assert.equal(Array.isArray(latestRun.dispatchPlan.gated), true);
    assert.equal(Array.isArray(latestRun.helperRuns), true);
    assert.equal(
      latestRun.dispatchPlan.helpers.some((helper) => helper.skill === "$align"),
      true,
    );
    assert.equal(
      latestRun.helperRuns.some((helper) => helper.skill === "$align"),
      true,
    );
    const alignRun = latestRun.helperRuns.find((helper) => helper.skill === "$align");
    const alignReceipt = alignRun.evidence.find((item) => item.record_type === "helper_receipt");
    assert.equal(alignRun.status, "completed");
    assert.equal(alignReceipt.skill, "$align");
    assert.equal(alignReceipt.records_as, "helper_alignment_receipt");
    assert.equal(alignReceipt.does_not_unlock.includes("build_gate"), true);
    assert.equal(alignReceipt.authority, "$maestro_or_owning_lane");
    assert.equal(typeof latestRun.pendingReview, "object");
    assert.equal(typeof latestRun.retry, "object");
    assert.equal(maestroState.schemaVersion, "0.1.0");
  } finally {
    if (previousRoot === undefined) {
      delete process.env.MA_ROOT;
    } else {
      process.env.MA_ROOT = previousRoot;
    }
  }
});
