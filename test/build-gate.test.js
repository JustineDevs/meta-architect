import assert from "node:assert/strict";
import test from "node:test";
import { evaluateBuildGate, formatNextAllowedTriggers } from "../src/build-gate.js";

const greenState = {
  idea_status: "CLEAR",
  architecture_status: "APPROVED",
  evidence_status: "VERIFIED",
  logic_status: "GREEN",
  security_status: "GREEN",
  experience_status: "GREEN",
  build_status: "LOCKED",
};

test("build gate fails when a required gate is red or missing", () => {
  const evaluation = evaluateBuildGate({
    ...greenState,
    logic_status: "RED",
    experience_status: "PENDING",
  });

  assert.equal(evaluation.allowed, false);
  assert.deepEqual(formatNextAllowedTriggers(evaluation), ["$flow", "$vibe"]);
});

test("build gate passes when all gates are green or waived", () => {
  const evaluation = evaluateBuildGate({
    ...greenState,
    experience_status: "WAIVED",
  });

  assert.equal(evaluation.allowed, true);
});
