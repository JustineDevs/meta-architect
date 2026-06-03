export const quorumDecisions = {
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  INDETERMINATE: "INDETERMINATE",
};

function createFingerprintKey(fingerprint) {
  if (!fingerprint || typeof fingerprint !== "object") {
    return null;
  }

  return JSON.stringify(fingerprint);
}

export function evaluateQuorumVotes(votes = []) {
  if (!Array.isArray(votes) || votes.length === 0) {
    return {
      decision: quorumDecisions.INDETERMINATE,
      winningFingerprint: null,
      blockers: ["No quorum votes were supplied."],
    };
  }

  const tallies = new Map();
  const majorityTarget = Math.floor(votes.length / 2) + 1;

  for (const vote of votes) {
    const fingerprintKey = createFingerprintKey(vote.fingerprint);
    const key = `${vote.decision}::${fingerprintKey ?? "null"}`;
    const tally = tallies.get(key) ?? {
      decision: vote.decision,
      fingerprint: vote.fingerprint ?? null,
      count: 0,
    };
    tally.count += 1;
    tallies.set(key, tally);
  }

  const winning = [...tallies.values()].find((entry) => entry.count >= majorityTarget);
  if (!winning) {
    return {
      decision: quorumDecisions.INDETERMINATE,
      winningFingerprint: null,
      blockers: ["Quorum votes did not converge on a majority-compatible fingerprint."],
    };
  }

  return {
    decision: winning.decision,
    winningFingerprint: winning.fingerprint,
    blockers: [],
  };
}

export function createQuorumReviewReceipt({ votes = [], evaluation }) {
  const result = evaluation ?? evaluateQuorumVotes(votes);
  const majorityFingerprint = result.winningFingerprint
    ? JSON.stringify(result.winningFingerprint)
    : null;
  const minorityVotes = votes.filter((vote) => {
    if (result.decision === quorumDecisions.INDETERMINATE) {
      return true;
    }
    return (
      vote.decision !== result.decision ||
      JSON.stringify(vote.fingerprint ?? null) !== majorityFingerprint
    );
  });

  return {
    record_type: "quorum_review_receipt",
    decision: result.decision,
    winningFingerprint: result.winningFingerprint,
    reviewer_count: votes.length,
    minority_report: minorityVotes.map((vote) => ({
      model_identifier: vote.model_identifier ?? "unknown",
      decision: vote.decision,
      fingerprint: vote.fingerprint ?? null,
      blockers: vote.blockers ?? [],
      rationale_summary: vote.rationale_summary ?? "",
    })),
    confidence_receipt: {
      records_as: "verification_confidence",
      production_evidence: false,
      may_mark_build_done: result.decision === quorumDecisions.APPROVED,
      requires_existing_build_gate_evidence: true,
    },
    blockers: result.blockers,
  };
}
