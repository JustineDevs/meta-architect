const gateChecks = [
  ["idea_status", "CLEAR", "ma idea"],
  ["architecture_status", "APPROVED", "$arch"],
  ["evidence_status", "VERIFIED", "$sage"],
  ["logic_status", "GREEN", "$flow"],
  ["security_status", "GREEN", "$vet"],
];

export function evaluateBuildGate(releaseState) {
  const blockers = [];

  for (const [field, expected, trigger] of gateChecks) {
    if (releaseState[field] !== expected) {
      blockers.push({ field, expected, actual: releaseState[field], trigger });
    }
  }

  const experienceAllowed =
    releaseState.experience_status === "GREEN" || releaseState.experience_status === "WAIVED";
  if (!experienceAllowed) {
    blockers.push({
      field: "experience_status",
      expected: "GREEN or WAIVED",
      actual: releaseState.experience_status,
      trigger: "$vibe",
    });
  }

  if (!["LOCKED", "READY"].includes(releaseState.build_status)) {
    blockers.push({
      field: "build_status",
      expected: "LOCKED or READY",
      actual: releaseState.build_status,
      trigger: "$build",
    });
  }

  return {
    allowed: blockers.length === 0,
    blockers,
  };
}

export function formatBuildBlockers(evaluation) {
  return evaluation.blockers.map(
    (blocker) => `${blocker.field} must be ${blocker.expected}; current value is ${blocker.actual}`,
  );
}

export function formatNextAllowedTriggers(evaluation) {
  return [...new Set(evaluation.blockers.map((blocker) => blocker.trigger))];
}
