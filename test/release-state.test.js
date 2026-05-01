import assert from "node:assert/strict";
import test from "node:test";
import { validateReleaseState } from "../src/release-state.js";

test("release state rejects invalid enum values", () => {
  assert.throws(
    () =>
      validateReleaseState({
        idea_status: "NOPE",
        architecture_status: "APPROVED",
        evidence_status: "VERIFIED",
        logic_status: "GREEN",
        security_status: "GREEN",
        experience_status: "GREEN",
        build_status: "LOCKED",
        merge_status: "LOCKED",
        release_status: "LOCKED",
      }),
    /Invalid idea_status/,
  );
});

test("release state requires waiver metadata", () => {
  assert.throws(
    () =>
      validateReleaseState({
        idea_status: "CLEAR",
        architecture_status: "APPROVED",
        evidence_status: "VERIFIED",
        logic_status: "GREEN",
        security_status: "GREEN",
        experience_status: "WAIVED",
        build_status: "LOCKED",
        merge_status: "LOCKED",
        release_status: "LOCKED",
      }),
    /waiver/,
  );
});
