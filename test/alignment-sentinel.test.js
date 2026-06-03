import assert from "node:assert/strict";
import test from "node:test";
import {
  createAlignmentRecoveryPlan,
  evaluateAlignmentDrift,
} from "../src/runtime/alignment-sentinel.js";

test("Alignment Sentinel creates bounded recovery plan for drifted lane state", () => {
  const report = evaluateAlignmentDrift({
    releaseState: {
      architecture_status: "DRAFT",
    },
    decisionLog: {
      decisions: [
        {
          skill: "$arch",
          status: "APPROVED",
          decision: "Architecture approved.",
          timestamp: "2026-06-02T00:00:00.000Z",
        },
      ],
    },
  });
  const recovery = createAlignmentRecoveryPlan(report);

  assert.equal(report.driftStatus, "DRIFTED");
  assert.equal(recovery.record_type, "alignment_recovery_plan");
  assert.equal(recovery.mayDispatchWorkers, false);
  assert.equal(recovery.mayMutateReleaseStateDirectly, false);
  assert.equal(recovery.requiredActions[0].skill, "$arch");
  assert.equal(recovery.requiredActions[0].repairField, "architecture_status");
});
