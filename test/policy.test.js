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

test("development and release branches are valid release origins", () => {
  assert.equal(validateReleaseOrigin("development"), true);
  assert.equal(validateReleaseOrigin("release/0.1.13"), true);
});

test("merge target policy only allows feature branches into development", () => {
  assert.equal(validateMergeTarget("feature/ui", "development"), true);
  assert.equal(validateMergeTarget("feature/ui", "prod"), false);
});

test("merge can only continue once the bounded build substep is done", () => {
  assert.equal(canMarkBuildDone({ build_status: "READY" }), false);
  assert.equal(canMarkBuildDone({ build_status: "RUNNING" }), false);
  assert.equal(canMarkBuildDone({ build_status: "DONE" }), true);
  assert.equal(canMarkBuildDone({ build_status: "LOCKED" }), false);
});
