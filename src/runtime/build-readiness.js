import {
  evaluateBuildGate,
  formatBuildBlockers,
  formatNextAllowedTriggers,
} from "../build-gate.js";

export function evaluateRuntimeBuildReadiness(releaseState, runtimeSummary, options = {}) {
  const enforceIssueGates = options.enforceIssueGates === true;
  const releaseEvaluation = evaluateBuildGate(releaseState);
  const missingArtifacts = runtimeSummary.missingArtifacts.filter(
    (artifact) => enforceIssueGates || artifact !== "release.issueGates",
  );
  const controlPlaneBlockers = [
    ...runtimeSummary.invalidArtifacts.filter((artifact) =>
      ["runtime.release", "runtime.decisions"].includes(artifact),
    ),
    ...missingArtifacts.filter(
      (artifact) => artifact === "runtime.release" || artifact === "runtime.decisions",
    ),
  ];
  const runtimeBlockers = [
    ...runtimeSummary.invalidArtifacts.map((artifact) => `runtime artifact ${artifact} is invalid`),
    ...missingArtifacts.map((artifact) => `runtime artifact ${artifact} is missing`),
    ...(runtimeSummary.pendingMailboxCount > 0
      ? ["pending mailbox proposals require leader review"]
      : []),
    ...(runtimeSummary.criticalPackageExposureCount > 0
      ? [
          `critical package exposure findings require $vet remediation (${runtimeSummary.criticalPackageExposureCount} active)`,
        ]
      : []),
    ...(runtimeSummary.mcpPolicyViolationCount > 0
      ? [
          `MCP policy validation findings require $vet remediation (${runtimeSummary.mcpPolicyViolationCount} active)`,
        ]
      : []),
    ...(enforceIssueGates && runtimeSummary.releaseIssueGateBlockerCount > 0
      ? [
          `release issue gates require implementation proof (${runtimeSummary.releaseIssueGatePassed}/${runtimeSummary.releaseIssueGateTotal} passed)`,
        ]
      : []),
  ];
  const releaseBlockers = formatBuildBlockers(releaseEvaluation);
  const nextTriggers =
    releaseEvaluation.allowed && runtimeBlockers.length > 0
      ? runtimeSummary.criticalPackageExposureCount > 0 ||
        runtimeSummary.mcpPolicyViolationCount > 0
        ? ["$vet"]
        : enforceIssueGates && runtimeSummary.releaseIssueGateBlockerCount > 0
          ? ["implement release issue gates"]
          : ["repair runtime artifacts"]
      : formatNextAllowedTriggers(releaseEvaluation);

  return {
    allowed: releaseEvaluation.allowed && runtimeBlockers.length === 0,
    controlPlaneBlockers,
    runtimeBlockers,
    releaseBlockers,
    blockers: [...releaseBlockers, ...runtimeBlockers],
    nextTriggers,
  };
}
