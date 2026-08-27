import assert from "node:assert/strict";
import test from "node:test";
import {
  canMarkBuildDone,
  rejectsDirectProdPromotion,
  validateMergeTarget,
  validateReleaseOrigin,
} from "../src/policy.js";

test("feature branches cannot release directly to prod", () => {
  assert.equal(rejectsDirectProdPromotion("feature/ui"), true);
  assert.equal(validateReleaseOrigin("feature/ui"), false);
});

test("dev and release branches are valid release origins", () => {
  assert.equal(validateReleaseOrigin("dev"), true);
  assert.equal(validateReleaseOrigin("release/0.14.0"), true);
});

test("merge target policy only allows feature branches into dev", () => {
  assert.equal(validateMergeTarget("feature/ui", "dev"), true);
  assert.equal(validateMergeTarget("feature/ui", "prod"), false);
});

test("merge can only continue once the bounded build substep is done", () => {
  assert.equal(canMarkBuildDone({ build_status: "READY" }), false);
  assert.equal(canMarkBuildDone({ build_status: "RUNNING" }), false);
  assert.equal(canMarkBuildDone({ build_status: "DONE" }), true);
  assert.equal(canMarkBuildDone({ build_status: "LOCKED" }), false);
});
