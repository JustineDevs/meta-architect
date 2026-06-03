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

test("build gate still passes while the bounded build substep is running", () => {
  const evaluation = evaluateBuildGate({
    ...greenState,
    build_status: "RUNNING",
  });

  assert.equal(evaluation.allowed, true);
});

test("runtime build readiness can be blocked by release issue gates", async () => {
  const { evaluateRuntimeBuildReadiness } = await import("../src/runtime/build-readiness.js");
  const evaluation = evaluateRuntimeBuildReadiness(
    {
      ...greenState,
      experience_status: "GREEN",
    },
    {
      invalidArtifacts: [],
      missingArtifacts: [],
      pendingMailboxCount: 0,
      criticalPackageExposureCount: 0,
      mcpPolicyViolationCount: 0,
      releaseIssueGateBlockerCount: 2,
      releaseIssueGatePassed: 15,
      releaseIssueGateTotal: 17,
    },
    { enforceIssueGates: true },
  );

  assert.equal(evaluation.allowed, false);
  assert.deepEqual(evaluation.nextTriggers, ["implement release issue gates"]);
  assert.match(evaluation.blockers.join("\n"), /15\/17 passed/);
});

test("runtime build readiness ignores missing issue gate matrix outside release mode", async () => {
  const { evaluateRuntimeBuildReadiness } = await import("../src/runtime/build-readiness.js");
  const runtimeSummary = {
    invalidArtifacts: [],
    missingArtifacts: ["release.issueGates"],
    pendingMailboxCount: 0,
    criticalPackageExposureCount: 0,
    mcpPolicyViolationCount: 0,
    releaseIssueGateBlockerCount: 17,
    releaseIssueGatePassed: 0,
    releaseIssueGateTotal: 17,
  };

  const normalEvaluation = evaluateRuntimeBuildReadiness(
    {
      ...greenState,
      experience_status: "GREEN",
    },
    runtimeSummary,
  );
  const releaseEvaluation = evaluateRuntimeBuildReadiness(
    {
      ...greenState,
      experience_status: "GREEN",
    },
    runtimeSummary,
    { enforceIssueGates: true },
  );

  assert.equal(normalEvaluation.allowed, true);
  assert.doesNotMatch(normalEvaluation.blockers.join("\n"), /release\.issueGates/);
  assert.equal(releaseEvaluation.allowed, false);
  assert.match(
    releaseEvaluation.blockers.join("\n"),
    /runtime artifact release\.issueGates is missing/,
  );
});

test("runtime build readiness routes MCP policy violations back to vet", async () => {
  const { evaluateRuntimeBuildReadiness } = await import("../src/runtime/build-readiness.js");
  const evaluation = evaluateRuntimeBuildReadiness(
    {
      ...greenState,
      experience_status: "GREEN",
    },
    {
      invalidArtifacts: [],
      missingArtifacts: [],
      pendingMailboxCount: 0,
      criticalPackageExposureCount: 0,
      mcpPolicyViolationCount: 1,
      releaseIssueGateBlockerCount: 0,
      releaseIssueGatePassed: 17,
      releaseIssueGateTotal: 17,
    },
  );

  assert.equal(evaluation.allowed, false);
  assert.deepEqual(evaluation.nextTriggers, ["$vet"]);
  assert.match(evaluation.blockers.join("\n"), /MCP policy validation findings/);
});
