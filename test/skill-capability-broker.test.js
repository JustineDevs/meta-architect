import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  brokerSkillsForTask,
  createSkillCompositionPlan,
  createSkillOutcomeFeedback,
  recordSkillKaizenCycle,
  rerouteSkillComposition,
} from "../src/runtime/skill-capability-broker.js";
import { executeSkillCompositionPlan } from "../src/runtime/skill-execution.js";
import { createTestNamespace, removeTestNamespace } from "../src/test-fixtures.js";

async function writeSkill(root, name, description, body = "") {
  const dir = path.join(root, name);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, "SKILL.md"),
    `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`,
  );
}

test("skill broker ranks project skills and reuses global skills without claiming execution", async (t) => {
  const root = createTestNamespace("ma-skill-broker-project");
  const home = createTestNamespace("ma-skill-broker-home");
  t.after(() => Promise.all([removeTestNamespace(root), removeTestNamespace(home)]));
  await writeSkill(
    path.join(root, ".agents", "skills"),
    "red-team-review",
    "Threat modeling and security review for production code",
  );
  await writeSkill(
    path.join(home, ".agents", "skills"),
    "performance-optimization",
    "Optimize latency, caching, and cloud cost after measuring real workloads",
  );

  const plan = await brokerSkillsForTask({
    cwd: root,
    home,
    taskIntent: "review authentication security and threat model the API",
  });

  assert.equal(plan.record_type, "skill_composition_plan");
  assert.equal(plan.selected[0].name, "red-team-review");
  assert.equal(plan.selected[0].scope, "repo_local");
  assert.equal(plan.selected[0].executionBoundary, "available_capability_only");
  assert.equal(plan.selected[0].evidenceStatus, "not_executed");
  assert.equal(plan.execution_policy.mutate_skill_sources, false);
  assert.deepEqual(plan.discovery.stages, ["collect", "classify", "rank", "compose", "bound"]);
  assert.equal(plan.discovery.framework, "chai-discovery");
  assert.equal(plan.improvement.framework, "kaizen");
  assert.equal(plan.improvement.phase, "plan");
  assert.equal(
    plan.selected.some((skill) => skill.name === "performance-optimization"),
    false,
  );
});

test("skill broker composes referenced skills and reroutes from verification feedback", () => {
  const core = {
    capabilities: [
      {
        record_type: "environment_capability",
        name: "red-team-review",
        capability_type: "skill",
        owner: "host_native",
        source_scope: "global_user_config",
        source_path: "~/.agents/skills/red-team-review",
        entrypoint: "SKILL.md",
        confidence: "high",
        metadata: { description: "security threat model", references: ["$test-first"] },
      },
      {
        record_type: "environment_capability",
        name: "test-first",
        capability_type: "skill",
        owner: "host_native",
        source_scope: "repo_local",
        source_path: ".agents/skills/test-first",
        entrypoint: "SKILL.md",
        confidence: "high",
        metadata: { description: "regression tests and coverage", references: [] },
      },
      {
        record_type: "environment_capability",
        name: "latency-optimization",
        capability_type: "skill",
        owner: "host_native",
        source_scope: "global_user_config",
        source_path: "~/.agents/skills/latency-optimization",
        entrypoint: "SKILL.md",
        confidence: "high",
        metadata: { description: "measure and reduce latency", references: [] },
      },
    ],
  };
  const plan = createSkillCompositionPlan({
    core,
    taskIntent: "security review threat model with regression tests",
  });
  assert.deepEqual(plan.dependencies, [{ from: "red-team-review", to: "test-first" }]);
  assert.equal(
    plan.selected.some((skill) => skill.name === "test-first"),
    true,
  );

  const rerouted = rerouteSkillComposition(plan, {
    reason: "verification found a latency regression",
    failedChecks: ["p95 latency"],
  });
  assert.equal(rerouted.feedback.reason, "verification found a latency regression");
  assert.equal(rerouted.improvement.iteration, 1);
  assert.equal(rerouted.improvement.phase, "act");
  assert.equal(
    rerouted.selected.some((skill) => skill.name === "latency-optimization"),
    true,
  );
  assert.equal(rerouted.never_records_as, "build_evidence");
});

test("skill execution loads selected instructions in dependency order and writes a receipt", async (t) => {
  const root = createTestNamespace("ma-skill-execution");
  t.after(() => removeTestNamespace(root));
  await writeSkill(
    path.join(root, ".agents", "skills"),
    "testing",
    "Regression tests",
    "Test first.",
  );
  await writeSkill(
    path.join(root, ".agents", "skills"),
    "architecture",
    "Architecture review",
    "Bound the system.",
  );
  const plan = createSkillCompositionPlan({
    core: {
      capabilities: [
        {
          record_type: "environment_capability",
          name: "architecture",
          capability_type: "skill",
          owner: "host_native",
          source_scope: "repo_local",
          source_path: ".agents/skills/architecture",
          entrypoint: "SKILL.md",
          metadata: { description: "Architecture review", references: ["$testing"] },
        },
        {
          record_type: "environment_capability",
          name: "testing",
          capability_type: "skill",
          owner: "host_native",
          source_scope: "repo_local",
          source_path: ".agents/skills/testing",
          entrypoint: "SKILL.md",
          metadata: { description: "Regression tests", references: [] },
        },
      ],
    },
    taskIntent: "architecture testing",
  });
  const previousRoot = process.env.MA_ROOT;
  process.env.MA_ROOT = root;
  try {
    const execution = await executeSkillCompositionPlan({
      plan,
      taskId: "skill-execution-test",
      cwd: root,
      home: root,
    });
    assert.equal(execution.status, "loaded");
    assert.deepEqual(execution.order, ["testing", "architecture"]);
    assert.equal(execution.instructionCount, 2);
    assert.equal(
      execution.execution.every((item) => item.mutationAllowed === false),
      true,
    );
    assert.equal((await fs.stat(execution.receiptPath)).isFile(), true);
    assert.match(execution.instructions[0].content, /Test first/);
  } finally {
    if (previousRoot === undefined) delete process.env.MA_ROOT;
    else process.env.MA_ROOT = previousRoot;
  }
});

test("skill execution blocks traversal outside the discovered skill source", async (t) => {
  const root = createTestNamespace("ma-skill-execution-boundary");
  t.after(() => removeTestNamespace(root));
  const outside = createTestNamespace("ma-skill-execution-outside");
  t.after(() => removeTestNamespace(outside));
  await fs.writeFile(path.join(outside, "SKILL.md"), "Do not load this file.");

  const plan = createSkillCompositionPlan({
    core: {
      capabilities: [
        {
          record_type: "environment_capability",
          name: "escape-attempt",
          capability_type: "skill",
          owner: "host_native",
          source_scope: "repo_local",
          source_path: root,
          entrypoint: `../${path.basename(outside)}/SKILL.md`,
          metadata: { description: "escape boundary regression", references: [] },
        },
      ],
    },
    taskIntent: "escape boundary regression",
  });
  const execution = await executeSkillCompositionPlan({
    plan,
    taskId: "skill-execution-boundary-test",
    cwd: root,
    home: root,
  });

  assert.equal(execution.status, "blocked");
  assert.equal(execution.instructions.length, 0);
  assert.equal(execution.execution[0].status, "blocked");
  assert.match(execution.execution[0].error, /escapes|outside|boundary|traversal/i);
});

test("skill broker matches common inflections before composing dependencies", () => {
  const plan = createSkillCompositionPlan({
    core: {
      capabilities: [
        {
          record_type: "environment_capability",
          name: "architecture",
          capability_type: "skill",
          owner: "host_native",
          source_scope: "repo_local",
          source_path: ".agents/skills/architecture",
          entrypoint: "SKILL.md",
          metadata: { description: "Design secure API boundaries", references: ["$testing"] },
        },
        {
          record_type: "environment_capability",
          name: "testing",
          capability_type: "skill",
          owner: "host_native",
          source_scope: "global_user_config",
          source_path: "~/.codex/skills/testing",
          entrypoint: "SKILL.md",
          metadata: { description: "Build API tests and regression checks", references: [] },
        },
      ],
    },
    taskIntent: "implement secure API tests",
  });
  assert.deepEqual(plan.dependencies, [{ from: "architecture", to: "testing" }]);
  assert.deepEqual(
    plan.selected.map((skill) => skill.name),
    ["testing", "architecture"],
  );
});

test("skill broker uses a bounded ambient fallback when the goal names no skill domain", () => {
  const plan = createSkillCompositionPlan({
    core: {
      capabilities: [
        {
          record_type: "environment_capability",
          name: "architecture",
          capability_type: "skill",
          owner: "host_native",
          source_scope: "repo_local",
          source_path: ".agents/skills/architecture",
          entrypoint: "SKILL.md",
          metadata: { description: "Design service boundaries", references: [] },
        },
        {
          record_type: "environment_capability",
          name: "security",
          capability_type: "skill",
          owner: "host_native",
          source_scope: "global_user_config",
          source_path: "~/.codex/skills/security",
          entrypoint: "SKILL.md",
          metadata: { description: "Threat model inputs", references: [] },
        },
        {
          record_type: "package-root",
          name: "package-root",
          capability_type: "plugin",
          owner: "ma_owned",
          source_scope: "package_local",
          source_path: "package://@jstn-sdk/ma",
          entrypoint: "package.json",
        },
      ],
    },
    taskIntent: "Add a billing dashboard for the team",
    maxSkills: 2,
  });
  assert.deepEqual(
    plan.selected.map((skill) => skill.name),
    ["architecture", "security"],
  );
  assert.ok(plan.selected.every((skill) => skill.reason === "ambient_fallback"));
  assert.equal(
    plan.skipped.some((skill) => skill.name === "package-root"),
    true,
  );
});

test("Kaizen outcome receipts preserve verification feedback without becoming build evidence", async () => {
  const root = createTestNamespace("ma-skill-kaizen");
  const previousRoot = process.env.MA_ROOT;
  process.env.MA_ROOT = root;
  try {
    const plan = createSkillCompositionPlan({
      core: { capabilities: [] },
      taskIntent: "improve tests",
    });
    const record = await recordSkillKaizenCycle({
      taskId: "task-1",
      plan,
      outcome: createSkillOutcomeFeedback({
        status: "failed",
        reason: "test failed",
        failedChecks: ["coverage"],
        evidence: ["npm test exited 1"],
        iteration: 1,
      }),
    });
    assert.equal(record.record_type, "skill_kaizen_cycle");
    assert.equal(record.improvement.outcome.failedChecks[0], "coverage");
    assert.equal(record.never_records_as, "build_evidence");
  } finally {
    if (previousRoot === undefined) delete process.env.MA_ROOT;
    else process.env.MA_ROOT = previousRoot;
    await removeTestNamespace(root);
  }
});
