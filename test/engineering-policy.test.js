import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultActiveAutonomyCore } from "../src/runtime/active-autonomy-core.js";
import {
  classifyEngineeringPriority,
  createDefaultEngineeringPolicy,
  createEngineeringPlan,
  validateEngineeringPlan,
} from "../src/runtime/engineering-policy.js";
import { createTaskContract } from "../src/runtime/task-contracts.js";

test("engineering priority classification follows explicit and policy rules", () => {
  assert.equal(
    classifyEngineeringPriority({ goal: "rewrite the docs", requestedPriority: "P0" }).priority,
    "P0",
  );
  assert.equal(
    classifyEngineeringPriority({ goal: "production outage affecting customers" }).priority,
    "P0",
  );
  assert.equal(
    classifyEngineeringPriority({ goal: "Implement authentication API" }).priority,
    "P1",
  );
  assert.equal(classifyEngineeringPriority({ goal: "Improve request latency" }).priority, "P2");
  assert.equal(classifyEngineeringPriority({ goal: "Polish a non-urgent label" }).priority, "P3");
});

test("engineering plans require all five stages and a contained rollout", () => {
  const plan = createEngineeringPlan({
    goal: "Fix the production authentication failure",
    requestedPriority: "P0",
    verification: ["npm test", "npm test"],
  });
  assert.equal(plan.triage.priority, "P0");
  assert.deepEqual(
    plan.execution_blueprint.map((entry) => entry.stage),
    ["understand", "design", "trim", "guardrails", "rollout"],
  );
  assert.equal(plan.safe_rollout.default_channel, "containment");
  assert.equal(plan.safe_rollout.monitor_before_promotion, true);
  assert.deepEqual(plan.verification, ["npm test"]);
  assert.doesNotThrow(() => validateEngineeringPlan(plan));
  assert.throws(
    () =>
      validateEngineeringPlan({
        ...plan,
        execution_blueprint: plan.execution_blueprint.slice(0, 4),
      }),
    /all five execution stages/,
  );
});

test("task contracts persist the senior plan as the default execution contract", () => {
  const contract = createTaskContract({
    goal: "Implement the core release requirement",
    risk: "high",
    stopCondition: "Tests and release checks pass",
  });
  assert.equal(contract.priority, "P1");
  assert.equal(contract.engineering_plan.record_type, "senior_engineering_plan");
  assert.equal(contract.engineering_plan.safe_rollout.external_mutation_requires_approval, true);
});

test("the default autonomy core exposes the senior engineering contract", () => {
  const core = createDefaultActiveAutonomyCore();
  assert.deepEqual(core.senior_engineering_contract.triage_levels, ["P0", "P1", "P2", "P3"]);
  assert.deepEqual(core.senior_engineering_contract.required_before_mutation, [
    "understand",
    "design",
    "trim",
  ]);
  assert.ok(core.senior_engineering_contract.rollout_rules.includes("monitor before promotion"));
});

test("the default policy is explicit and complete", () => {
  const policy = createDefaultEngineeringPolicy();
  assert.equal(policy.default, true);
  assert.deepEqual(Object.keys(policy.priorities).sort(), ["P0", "P1", "P2", "P3"]);
  assert.deepEqual(policy.execution_blueprint, [
    "understand",
    "design",
    "trim",
    "guardrails",
    "rollout",
  ]);
});
