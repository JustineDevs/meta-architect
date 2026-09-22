import assert from "node:assert/strict";
import test from "node:test";
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
