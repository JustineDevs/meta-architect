import assert from "node:assert/strict";
import test from "node:test";
import {
  createQuorumReviewReceipt,
  evaluateQuorumVotes,
  quorumDecisions,
} from "../src/runtime/quorum-review.js";

test("quorum review receipt records confidence without production evidence", () => {
  const votes = [
    {
      model_identifier: "a",
      decision: "APPROVED",
      fingerprint: { hash: "same" },
      blockers: [],
    },
    {
      model_identifier: "b",
      decision: "APPROVED",
      fingerprint: { hash: "same" },
      blockers: [],
    },
    {
      model_identifier: "c",
      decision: "REJECTED",
      fingerprint: { hash: "other" },
      blockers: ["risk"],
    },
  ];
  const evaluation = evaluateQuorumVotes(votes);
  const receipt = createQuorumReviewReceipt({ votes, evaluation });

  assert.equal(evaluation.decision, quorumDecisions.APPROVED);
  assert.equal(receipt.record_type, "quorum_review_receipt");
  assert.equal(receipt.confidence_receipt.records_as, "verification_confidence");
  assert.equal(receipt.confidence_receipt.production_evidence, false);
  assert.equal(receipt.confidence_receipt.requires_existing_build_gate_evidence, true);
  assert.equal(receipt.minority_report.length, 1);
});
