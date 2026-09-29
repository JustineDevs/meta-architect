import assert from "node:assert/strict";
import test from "node:test";
import {
  canMarkBuildDone,
  rejectsDirectProdPromotion,
  validateMergeTarget,
  validateReleaseOrigin,
} from "../src/policy.js";

test("only dev can promote to the release branch", () => {
  assert.equal(rejectsDirectProdPromotion("feature/ui"), true);
  assert.equal(rejectsDirectProdPromotion("release/0.15.3"), true);
  assert.equal(rejectsDirectProdPromotion("dev"), false);
  assert.equal(validateReleaseOrigin("feature/ui"), false);
});

test("dev is the only valid release origin", () => {
  assert.equal(validateReleaseOrigin("dev"), true);
  assert.equal(validateReleaseOrigin("release/0.15.3"), false);
  assert.equal(validateReleaseOrigin("main"), false);
});

test("merge target policy only allows dev into main", () => {
  assert.equal(validateMergeTarget("dev", "main"), true);
  assert.equal(validateMergeTarget("feature/ui", "dev"), false);
  assert.equal(validateMergeTarget("dev", "prod"), false);
});

test("merge can only continue once the bounded build substep is done", () => {
  assert.equal(canMarkBuildDone({ build_status: "READY" }), false);
  assert.equal(canMarkBuildDone({ build_status: "RUNNING" }), false);
  assert.equal(canMarkBuildDone({ build_status: "DONE" }), true);
  assert.equal(canMarkBuildDone({ build_status: "LOCKED" }), false);
});
