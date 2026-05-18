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

async function loadModules() {
  const stamp = Date.now();
  const skills = await import(
    `${pathToFileURL(path.join(repoRoot, "src", "skills.js")).href}?t=${stamp}`
  );
  const decisions = await import(
    `${pathToFileURL(path.join(repoRoot, "src", "decision-log.js")).href}?t=${stamp}`
  );
  const stateSync = await import(
    `${pathToFileURL(path.join(repoRoot, "src", "state-sync.js")).href}?t=${stamp}`
  );
  const release = await import(
    `${pathToFileURL(path.join(repoRoot, "src", "release-state.js")).href}?t=${stamp}`
  );
  const fsUtils = await import(
    `${pathToFileURL(path.join(repoRoot, "src", "fs-utils.js")).href}?t=${stamp}`
  );
  const bootstrap = await import(
    `${pathToFileURL(path.join(repoRoot, "src", "bootstrap.js")).href}?t=${stamp}`
  );
  const { spawnPortable } = await import(
    `${pathToFileURL(path.join(repoRoot, "test", "helpers", "spawn-portable.js")).href}?t=${stamp}`
  );
  const buildReadiness = await import(
    `${pathToFileURL(path.join(repoRoot, "src", "runtime", "build-readiness.js")).href}?t=${stamp}`
  );
  const runtimeState = await import(
    `${pathToFileURL(path.join(repoRoot, "src", "runtime", "runtime-state.js")).href}?t=${stamp}`
  );
  return {
    skills,
    decisions,
    stateSync,
    release,
    fsUtils,
    bootstrap,
    spawnPortable,
    buildReadiness,
    runtimeState,
  };
}

async function withTempRepo(run) {
  const tempRoot = await createTempRepo("meta-architect-runtime-state-", repoRoot);
  const previousRoot = process.env.MA_ROOT;
  const previousCodexHome = process.env.CODEX_HOME;
  const previousCodexBin = process.env.MA_CODEX_BIN;
  process.env.MA_ROOT = tempRoot;

  try {
    return await run(tempRoot);
  } finally {
    if (previousRoot === undefined) {
      delete process.env.MA_ROOT;
    } else {
      process.env.MA_ROOT = previousRoot;
    }

    if (previousCodexHome === undefined) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = previousCodexHome;
    }

    if (previousCodexBin === undefined) {
      delete process.env.MA_CODEX_BIN;
    } else {
      process.env.MA_CODEX_BIN = previousCodexBin;
    }
  }
}

function getManagerRunsPath(tempRoot) {
  return path.join(tempRoot, ".ma", "state", "manager-runs.json");
}

async function loadManagerRuns(tempRoot) {
  return JSON.parse(await fs.readFile(getManagerRunsPath(tempRoot), "utf8"));
}

test("runInit seeds manager-run persistence for autonomous maestro state", async () => {
  await withTempRepo(async (tempRoot) => {
    const { skills } = await loadModules();

    await skills.runInit();

    const managerRuns = await loadManagerRuns(tempRoot);
    assert.equal(managerRuns.schemaVersion, "0.1.0");
    assert.deepEqual(managerRuns.runs, []);
  });
});

test("non-leader proposals are queued and flow blocks workers without workspaces", async () => {
  await withTempRepo(async (tempRoot) => {
    const { skills, decisions, stateSync, release, fsUtils } = await loadModules();

    await skills.runInit();
    await fsUtils.writeJson(path.join(tempRoot, ".ma", "tasks", "registry.json"), {
      schemaVersion: "0.1.0",
      leader: "captain",
      workers: [],
      tasks: [],
    });

    const proposalDecision = {
      decision: "Worker proposed gate update",
      status: "PROPOSED",
      evidence: [],
      blockers: [],
      next_allowed_triggers: [],
    };

    assert.equal(
      (await decisions.appendDecision(proposalDecision, { actor: "captain" })).proposed,
      false,
    );
    assert.equal(
      (await decisions.appendDecision(proposalDecision, { actor: "worker-1" })).proposed,
      true,
    );
    assert.equal(
      (await stateSync.syncStatusUpdates({ idea_status: "CLEAR" }, { actor: "worker-1" })).proposed,
      true,
    );

    const loadedDecisions = await decisions.loadDecisionLog();
    const loadedRelease = await release.loadReleaseState();
    const mailboxFiles = await fs.readdir(path.join(tempRoot, ".ma", "tasks", "mailbox"));
    assert.equal(loadedDecisions.decisions.length, 1);
    assert.equal(loadedRelease.idea_status, "DRAFT");
    assert.equal(mailboxFiles.length >= 2, true);

    assert.equal((await stateSync.syncStatusUpdates({ idea_status: "CLEAR" })).proposed, false);
    assert.equal(
      (await stateSync.syncStatusUpdates({ evidence_status: "VERIFIED" })).proposed,
      false,
    );

    await fsUtils.writeJson(path.join(tempRoot, ".ma", "tasks", "registry.json"), {
      schemaVersion: "0.1.0",
      leader: "captain",
      workers: ["worker-1"],
      tasks: [],
    });
    await fsUtils.writeJson(path.join(tempRoot, ".ma", "workspaces", "index.json"), {
      schemaVersion: "0.1.0",
      items: [],
    });

    await skills.runFlow();

    const blockedRelease = await release.loadReleaseState();
    const logicSpec = await fs.readFile(path.join(tempRoot, ".ma", "specs", "logic.md"), "utf8");
    assert.equal(blockedRelease.logic_status, "RED");
    assert.match(logicSpec, /Workers exist without registered workspaces/);
    assert.match(logicSpec, /`\$flow`/);
  });
});

test("invalid control-plane state is rejected before lane-side writes", async () => {
  await withTempRepo(async (tempRoot) => {
    const { skills, stateSync, release, fsUtils } = await loadModules();

    await skills.runInit();
    await fs.writeFile(path.join(tempRoot, ".ma", "release.json"), "{not-json");
    await fs.rm(path.join(tempRoot, ".ma", "plans", "maestro.md"), { force: true });
    const originalProjectContext = await fs.readFile(
      path.join(tempRoot, ".ma", "context", "project.md"),
      "utf8",
    );

    await assert.rejects(
      () => skills.runIdea("Corrupt release should not mutate context"),
      /Invalid runtime artifacts: runtime\.release/,
    );
    await assert.rejects(() => skills.runMaestro(), /Invalid runtime artifacts: runtime\.release/);
    await assert.rejects(() => stateSync.syncStatusUpdates({ idea_status: "CLEAR" }));
    assert.equal(
      await fs.readFile(path.join(tempRoot, ".ma", "context", "project.md"), "utf8"),
      originalProjectContext,
    );

    await skills.runInit();
    await fsUtils.writeJson(path.join(tempRoot, ".ma", "release.json"), cleanRelease);
    await fsUtils.writeJson(path.join(tempRoot, ".ma", "decisions.json"), cleanDecisions);
    await stateSync.syncStatusUpdates({ evidence_status: "VERIFIED" });
    await fs.writeFile(path.join(tempRoot, ".ma", "guidance", "merged.json"), "{}\n");
    await skills.runFlow();
    const invalidGuidanceRelease = await release.loadReleaseState();
    const invalidGuidanceLogic = await fs.readFile(
      path.join(tempRoot, ".ma", "specs", "logic.md"),
      "utf8",
    );
    assert.equal(invalidGuidanceRelease.logic_status, "RED");
    assert.match(invalidGuidanceLogic, /Invalid runtime artifacts: guidance\.merged/);

    await skills.runInit();
    await fsUtils.writeJson(path.join(tempRoot, ".ma", "release.json"), cleanRelease);
    await fsUtils.writeJson(path.join(tempRoot, ".ma", "decisions.json"), cleanDecisions);
    await fs.writeFile(path.join(tempRoot, ".ma", "decisions.json"), "{}\n");
    const logicBeforeDecisionFailure = await fs.readFile(
      path.join(tempRoot, ".ma", "specs", "logic.md"),
      "utf8",
    );
    await assert.rejects(() => skills.runFlow(), /Invalid runtime artifacts: runtime\.decisions/);
    await assert.rejects(() => stateSync.syncStatusUpdates({ idea_status: "CLEAR" }));
    assert.equal(
      await fs.readFile(path.join(tempRoot, ".ma", "specs", "logic.md"), "utf8"),
      logicBeforeDecisionFailure,
    );
    assert.equal((await release.loadReleaseState()).idea_status, "DRAFT");
  });
});

test("invalid authority blocks lane writes and direct mutations", async () => {
  await withTempRepo(async (tempRoot) => {
    const { skills, stateSync, fsUtils } = await loadModules();

    await skills.runInit();
    await fsUtils.writeJson(path.join(tempRoot, ".ma", "tasks", "registry.json"), {
      schemaVersion: "0.1.0",
      leader: 42,
      workers: [],
      tasks: [],
    });

    const originalLogicSpec = await fs.readFile(
      path.join(tempRoot, ".ma", "specs", "logic.md"),
      "utf8",
    );
    await assert.rejects(() => skills.runFlow(), /Invalid runtime authority: tasks\.registry/);
    await fs.rm(path.join(tempRoot, ".ma", "plans", "maestro.md"), { force: true });
    await assert.rejects(() => skills.runMaestro(), /Invalid runtime authority: tasks\.registry/);
    await assert.rejects(
      () => stateSync.syncStatusUpdates({ idea_status: "CLEAR" }),
      /Invalid runtime authority: tasks\.registry/,
    );
    assert.equal(
      await fs.readFile(path.join(tempRoot, ".ma", "specs", "logic.md"), "utf8"),
      originalLogicSpec,
    );
  });
});

test("invalid authority blocks architecture writes before mutating the first pillar", async () => {
  await withTempRepo(async (tempRoot) => {
    const { skills, fsUtils } = await loadModules();

    await skills.runInit();
    await skills.runIdea("Build a demo");
    const architectureSpecPath = path.join(tempRoot, ".ma", "specs", "architecture.md");
    const implementationPlanPath = path.join(tempRoot, ".ma", "plans", "implementation.md");
    const originalArchitectureSpec = await fs.readFile(architectureSpecPath, "utf8");
    const originalImplementationPlan = await fs.readFile(implementationPlanPath, "utf8");

    await fsUtils.writeJson(path.join(tempRoot, ".ma", "tasks", "registry.json"), {
      schemaVersion: "0.1.0",
      leader: 42,
      workers: [],
      tasks: [],
    });

    await assert.rejects(() => skills.runArch(), /Invalid runtime authority: tasks\.registry/);
    assert.equal(await fs.readFile(architectureSpecPath, "utf8"), originalArchitectureSpec);
    assert.equal(await fs.readFile(implementationPlanPath, "utf8"), originalImplementationPlan);
  });
});

test("local capability mutation tools do not inherit leader authority", async () => {
  await withTempRepo(async (tempRoot) => {
    const { skills, decisions, release } = await loadModules();
    const stateCapability = await import(
      `${pathToFileURL(path.join(repoRoot, "mcp", "local", "state.js")).href}?t=${Date.now()}`
    );
    const memoryCapability = await import(
      `${pathToFileURL(path.join(repoRoot, "mcp", "local", "memory.js")).href}?t=${Date.now()}`
    );

    await skills.runInit();
    const originalContext = await fs.readFile(
      path.join(tempRoot, ".ma", "context", "project.md"),
      "utf8",
    );

    const stateResult = await stateCapability.callStateTool("state.sync_release_status", {
      idea_status: "CLEAR",
    });
    const decisionResult = await stateCapability.callStateTool("state.append_decision", {
      decision: "Local capability proposal",
      status: "PROPOSED",
      evidence: [],
      blockers: [],
      next_allowed_triggers: [],
    });
    const memoryResult = await memoryCapability.callMemoryTool("memory.store_note", {
      content: "runtime note",
    });

    assert.equal(stateResult.proposed, true);
    assert.equal(decisionResult.proposed, true);
    assert.equal(memoryResult.proposed, true);
    assert.equal((await decisions.loadDecisionLog()).decisions.length, 0);
    assert.equal((await release.loadReleaseState()).idea_status, "DRAFT");
    assert.deepEqual((await loadManagerRuns(tempRoot)).runs, []);
    assert.equal(
      await fs.readFile(path.join(tempRoot, ".ma", "context", "project.md"), "utf8"),
      originalContext,
    );
  });
});

test("team_run local capability remains proposal-only and does not claim coordination ownership", async () => {
  await withTempRepo(async (tempRoot) => {
    const { skills } = await loadModules();
    const teamRunCapability = await import(
      `${pathToFileURL(path.join(repoRoot, "mcp", "local", "team-run.js")).href}?t=${Date.now()}`
    );

    await skills.runInit();

    const submitResult = await teamRunCapability.callTeamRunTool("team_run.submit_task", {
      title: "verification lane",
    });

    assert.equal(submitResult.proposed, true);
    assert.deepEqual((await loadManagerRuns(tempRoot)).runs, []);

    const registry = JSON.parse(
      await fs.readFile(path.join(tempRoot, ".ma", "tasks", "registry.json"), "utf8"),
    );
    const mailboxFiles = await fs.readdir(path.join(tempRoot, ".ma", "tasks", "mailbox"));

    assert.deepEqual(registry.tasks, []);
    assert.equal(mailboxFiles.length > 0, true);
  });
});

test("public _state status updates reject unknown top-level fields", async () => {
  await withTempRepo(async () => {
    const { skills, stateSync } = await loadModules();

    await skills.runInit();

    await assert.rejects(
      () =>
        stateSync.syncStatusUpdates({
          idea_status: "CLEAR",
          arbitrary_field: "should-not-pass",
        }),
      /Unknown release status field\(s\): arbitrary_field/,
    );
  });
});

test("bootstrap and doctor downgrade readiness when runtime artifacts are malformed", async () => {
  await withTempRepo(async (tempRoot) => {
    const { skills, fsUtils, bootstrap } = await loadModules();

    await skills.runInit();
    await fsUtils.writeJson(path.join(tempRoot, ".ma", "release.json"), cleanRelease);
    await fsUtils.writeJson(path.join(tempRoot, ".ma", "decisions.json"), cleanDecisions);
    await fsUtils.writeJson(path.join(tempRoot, ".ma", "tasks", "registry.json"), {
      schemaVersion: "0.1.0",
      leader: "leader",
      workers: [],
      tasks: [],
    });
    await fsUtils.writeJson(path.join(tempRoot, ".ma", "guidance", "merged.json"), {
      schemaVersion: "0.1.0",
      sources: [],
      content: "",
    });

    const codexHome = path.join(tempRoot, "codex-home");
    const codexBin = path.join(tempRoot, "fake-codex-cli");
    await fs.writeFile(
      codexBin,
      `#!/usr/bin/env bash
set -euo pipefail

if [ "\${1:-}" = "--version" ]; then
  echo "codex-cli test"
  exit 0
fi

exit 0
`,
      { mode: 0o755 },
    );
    await fs.chmod(codexBin, 0o755);
    process.env.CODEX_HOME = codexHome;
    process.env.MA_CODEX_BIN = codexBin;

    assert.equal((await bootstrap.runBootstrap()).result, "READY");
    await fs.writeFile(path.join(tempRoot, ".ma", "guidance", "merged.json"), "{}\n");
    assert.equal((await bootstrap.runBootstrap()).result, "READY_WITH_WARNINGS");
    assert.equal((await bootstrap.runDoctor()).result, "READY_WITH_WARNINGS");
  });
});

test("missing release blocks build before rewriting build plan", async () => {
  await withTempRepo(async (tempRoot) => {
    const { skills, spawnPortable } = await loadModules();

    await skills.runInit();
    const buildPlanPath = path.join(tempRoot, ".ma", "plans", "build.md");
    const originalBuildPlan = await fs.readFile(buildPlanPath, "utf8");
    await fs.rm(path.join(tempRoot, ".ma", "release.json"));

    const result = spawnPortable(
      process.execPath,
      [path.join(repoRoot, "bin", "ma.js"), "run", "$build"],
      {
        cwd: tempRoot,
        env: { ...process.env, MA_ROOT: tempRoot },
        encoding: "utf8",
      },
    );

    assert.equal(result.status, 1);
    assert.equal(await fs.readFile(buildPlanPath, "utf8"), originalBuildPlan);
  });
});

test("runtime-aware build readiness points to repair and maestro mirrors that routing", async () => {
  await withTempRepo(async (tempRoot) => {
    const { skills, fsUtils, release, buildReadiness, runtimeState } = await loadModules();

    await skills.runInit();
    await skills.runIdea("Build a runtime-aware readiness demo");
    await fsUtils.writeJson(path.join(tempRoot, ".ma", "release.json"), {
      ...cleanRelease,
      idea_status: "CLEAR",
      architecture_status: "APPROVED",
      evidence_status: "VERIFIED",
      logic_status: "GREEN",
      security_status: "GREEN",
      experience_status: "GREEN",
    });
    await fs.writeFile(path.join(tempRoot, ".ma", "guidance", "merged.json"), "{}\n");

    const runtimeSnapshot = await runtimeState.loadRuntimeSnapshot();
    const runtimeSummary = runtimeState.createRuntimeSummary(runtimeSnapshot);
    const readiness = buildReadiness.evaluateRuntimeBuildReadiness(
      await release.loadReleaseState(),
      runtimeSummary,
    );

    assert.equal(readiness.allowed, false);
    assert.deepEqual(readiness.nextTriggers, ["repair runtime artifacts"]);

    await skills.runMaestro();
    const maestroPlan = await fs.readFile(
      path.join(tempRoot, ".ma", "plans", "maestro.md"),
      "utf8",
    );
    assert.match(maestroPlan, /repair runtime artifacts/);
    assert.doesNotMatch(maestroPlan, /Unlock bounded implementation planning/);
  });
});
