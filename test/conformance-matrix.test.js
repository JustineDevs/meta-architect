import assert from "node:assert/strict";
import test from "node:test";
import {
  createConformanceMatrix,
  validateConformanceMatrix,
} from "../src/runtime/conformance-matrix.js";

test("conformance matrix lists every lane, subsystem, and vendor surface separately", () => {
  const matrix = createConformanceMatrix();
  assert.deepEqual(matrix.counts, {
    expert_lanes: 6,
    support_lanes: 5,
    subsystems: 22,
    vendor_surfaces: 55,
    total: 88,
  });
  assert.equal(matrix.policy.distribution_does_not_imply_runtime, true);
  assert.equal(matrix.entries.length, 88);
  for (const entry of matrix.entries) {
    assert.ok(entry.owner);
    assert.ok(entry.inputs.length > 0);
    assert.ok(entry.outputs.length > 0);
    assert.ok(entry.mutation_boundary);
    assert.ok(entry.receipt);
    assert.ok(entry.test);
    assert.ok(entry.live_runtime_proof);
  }
  assert.equal(validateConformanceMatrix(matrix), matrix);
});

test("live conformance evidence updates only the named vendor surfaces", () => {
  const matrix = createConformanceMatrix({
    liveReport: {
      results: [{ target: "codex", status: "runtime-verified", version: "test" }],
    },
  });
  const codex = matrix.entries.find(
    (entry) => entry.category === "vendor-surface" && entry.id === "codex",
  );
  const cursor = matrix.entries.find(
    (entry) => entry.category === "vendor-surface" && entry.id === "cursor",
  );
  assert.match(codex.live_runtime_proof, /runtime-verified/);
  assert.match(cursor.live_runtime_proof, /requires verify --agents-live/);
});
