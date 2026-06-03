import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseHelperRoute,
  createDefaultHelperOrchestrationCore,
  createHelperReceipt,
  evaluateHelperCoreCoverage,
  helperSkillNames,
  resolveHelperContract,
  validateHelperOrchestrationCore,
} from "../src/runtime/helper-orchestration-core.js";

test("helper orchestration core defines all four helpers as non-gating contracts", () => {
  const core = validateHelperOrchestrationCore(createDefaultHelperOrchestrationCore());
  const coverage = evaluateHelperCoreCoverage(core);

  assert.deepEqual(
    core.helper_contracts.map((contract) => contract.skill),
    helperSkillNames,
  );
  assert.equal(core.composition_rules.non_gating, true);
  assert.equal(core.composition_rules.release_state_mutation_allowed, false);
  assert.equal(core.composition_rules.never_records_as, "gate_approval");
  assert.equal(coverage.helper_count, 4);
  assert.equal(coverage.non_gating, true);
  assert.equal(coverage.release_state_mutation_allowed, false);
  assert.equal(coverage.all_helpers_defined, true);
});

test("helper route composes align, diagnose, tdd, and cleanup from workspace state", () => {
  const route = chooseHelperRoute({
    releaseState: {
      idea_status: "CLEAR",
      architecture_status: "DRAFT",
      logic_status: "RED",
      security_status: "GREEN",
      build_status: "DONE",
    },
    runtimeSummary: {
      pendingMailboxCount: 2,
      invalidArtifacts: ["context.promptStrategyCore"],
    },
    taskIntent: "cleanup docs after regression test failure and terminology drift",
  });

  assert.deepEqual(
    route.helpers.map((helper) => helper.skill),
    ["$align", "$diagnose", "$tdd", "$cleanup"],
  );
  assert.equal(route.non_gating, true);
  assert.equal(route.release_state_mutation_allowed, false);
  assert.equal(route.next_owner, "$maestro_or_release_verification");
});

test("helper receipts preserve authority boundaries and exact next trigger", () => {
  const contract = resolveHelperContract("$tdd");
  const receipt = createHelperReceipt({
    skill: "$tdd",
    objective: "Lock build-slice behavior before cleanup",
    observedContext: "Build slice is READY and refactor risk exists.",
    result: "Added smallest regression test shape for the owning lane.",
    nextTrigger: "$build",
  });

  assert.equal(contract.semantic_role, "regression_first_boundary");
  assert.equal(receipt.record_type, "helper_receipt");
  assert.equal(receipt.skill, "$tdd");
  assert.equal(receipt.records_as, "helper_tdd_receipt");
  assert.equal(receipt.does_not_unlock.includes("build_gate"), true);
  assert.equal(receipt.next_trigger, "$build");
  assert.equal(receipt.authority, "$maestro_or_owning_lane");
});
