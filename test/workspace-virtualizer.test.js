import assert from "node:assert/strict";
import test from "node:test";
import {
  createDefaultWorkspaceVirtualizer,
  createVirtualVerificationReceipt,
  createVirtualWorkspacePlan,
  validateWorkspaceVirtualizer,
} from "../src/runtime/workspace-virtualizer.js";

test("workspace virtualizer separates synthetic checks from production evidence", () => {
  const core = validateWorkspaceVirtualizer(createDefaultWorkspaceVirtualizer());
  const plan = createVirtualWorkspacePlan({
    commands: ["npm test", ""],
    touchpoints: ["src/build-gate.js"],
    root: "/repo",
  });

  assert.equal(core.evidence_boundary.records_as, "virtual_workspace_result");
  assert.equal(core.evidence_boundary.never_records_as, "production_evidence");
  assert.equal(plan.record_type, "virtual_workspace_result");
  assert.equal(plan.source_mutation_allowed, false);
  assert.equal(plan.production_evidence, false);
  assert.deepEqual(plan.commands, ["npm test"]);
});

test("workspace virtualizer receipts never become production evidence", () => {
  const plan = createVirtualWorkspacePlan({
    commands: ["npm test"],
    touchpoints: ["src/build-gate.js"],
    root: "/repo",
  });
  const receipt = createVirtualVerificationReceipt({
    plan,
    commandResults: [{ command: "npm test", exitCode: 0, outputPreview: "pass" }],
  });

  assert.equal(receipt.record_type, "virtual_verification_receipt");
  assert.equal(receipt.records_as, "virtual_workspace_result");
  assert.equal(receipt.passed, true);
  assert.equal(receipt.production_evidence, false);
  assert.equal(receipt.source_mutation_allowed, false);
});
