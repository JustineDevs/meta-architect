import assert from "node:assert/strict";
import test from "node:test";
import glossary from "../data/system-design-glossary.json" with { type: "json" };
import registry from "../mcp/source-registry.json" with { type: "json" };
import {
  createLaneReceipt,
  expertLanes,
  getExpertLane,
  validateExpertLanes,
} from "../src/runtime/expert-lanes.js";
import {
  canUnlockEvidence,
  selectSourcesForLane,
  validateSourceRegistry,
} from "../src/runtime/source-registry.js";

test("expert lane registry exposes bounded enterprise ownership", () => {
  assert.equal(validateExpertLanes(expertLanes).length, 6);
  assert.equal(getExpertLane("$sage").domain, "engineering evidence and technology selection");
  assert.equal(getExpertLane("$build").owns.includes("file-changes"), true);
});

test("lane receipts preserve tradeoffs, assumptions, and evidence boundaries", () => {
  const receipt = createLaneReceipt({
    lane: "$arch",
    status: "completed",
    decision: "Use explicit service boundaries",
    evidence: [{ source: "project", status: "verified" }],
    tradeoffs: ["More modules, clearer ownership"],
    assumptions: ["Single deployment region"],
  });
  assert.equal(receipt.recordType, "expert_lane_receipt");
  assert.deepEqual(receipt.tradeoffs, ["More modules, clearer ownership"]);
});

test("source registry prevents discovery sources from unlocking Sage evidence", () => {
  validateSourceRegistry(registry);
  const sageSources = selectSourcesForLane(registry, "sage");
  const discovery = registry.sources.find((source) => source.role === "discovery");
  assert.equal(sageSources.includes(discovery), false);
  assert.equal(canUnlockEvidence(discovery), false);
  assert.equal(canUnlockEvidence(sageSources[0]), true);
});

test("each gated lane declares a domain-specific evidence dossier", () => {
  const expected = {
    arch: "software-architecture-guild",
    sage: "technology-evidence",
    flow: "reliability-and-recovery",
    vet: "security-verification",
    vibe: "accessibility-and-usability",
    build: "supply-chain-readiness",
  };

  for (const [laneId, dossier] of Object.entries(expected)) {
    const lane = getExpertLane(laneId);
    assert.equal(lane.dossier, dossier);
    assert.ok(lane.dossierSources.length > 0);
    for (const sourceId of lane.dossierSources) {
      const source = registry.sources.find((candidate) => candidate.id === sourceId);
      assert.ok(source, `${laneId} dossier source ${sourceId} is registered`);
      assert.equal(source.allowedLanes.includes(laneId), true);
      assert.equal(canUnlockEvidence(source), true);
    }
  }
});

test("lane receipts preserve dossier provenance", () => {
  const receipt = createLaneReceipt({
    lane: "$vet",
    status: "completed",
    decision: "Require verified controls for the public API boundary",
  });
  assert.equal(receipt.dossier, "security-verification");
  assert.deepEqual(receipt.dossierSources, ["owasp-asvs-authoritative", "slsa-authoritative"]);
});

test("architecture glossary is bounded, structured, and explicit about evidence limits", () => {
  assert.equal(glossary.recordType, "system_design_glossary");
  assert.equal(glossary.policy.termDefinitionsAreNotEvidence, true);
  assert.equal(glossary.terms.length >= 20, true);
  assert.equal(new Set(glossary.terms.map((term) => term.id)).size, glossary.terms.length);
  assert.equal(
    glossary.terms.some((term) => term.id === "event-driven-architecture"),
    true,
  );
  assert.equal(
    glossary.terms.some((term) => term.id === "rollback-strategy"),
    true,
  );
  for (const term of glossary.terms) {
    assert.ok(term.term);
    assert.ok(term.definition);
    assert.ok(Array.isArray(term.concerns));
  }
});
