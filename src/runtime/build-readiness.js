import {
  evaluateBuildGate,
  formatBuildBlockers,
  formatNextAllowedTriggers,
} from "../build-gate.js";

export function evaluateRuntimeBuildReadiness(releaseState, runtimeSummary) {
  const releaseEvaluation = evaluateBuildGate(releaseState);
  const controlPlaneBlockers = [
    ...runtimeSummary.invalidArtifacts.filter((artifact) =>
      ["runtime.release", "runtime.decisions"].includes(artifact),
    ),
    ...runtimeSummary.missingArtifacts.filter(
      (artifact) => artifact === "runtime.release" || artifact === "runtime.decisions",
    ),
  ];
  const runtimeBlockers = [
    ...runtimeSummary.invalidArtifacts.map((artifact) => `runtime artifact ${artifact} is invalid`),
    ...runtimeSummary.missingArtifacts.map((artifact) => `runtime artifact ${artifact} is missing`),
    ...(runtimeSummary.pendingMailboxCount > 0
      ? ["pending mailbox proposals require leader review"]
      : []),
  ];
  const releaseBlockers = formatBuildBlockers(releaseEvaluation);
  const nextTriggers =
    releaseEvaluation.allowed && runtimeBlockers.length > 0
      ? ["repair runtime artifacts"]
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
