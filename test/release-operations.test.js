import assert from "node:assert/strict";
import test from "node:test";
import { getGitOperation } from "../src/release-operations.js";

test("release operations produce an explicit safe merge command", () => {
  const operation = getGitOperation("feature/ui", "development");
  assert.deepEqual(operation.args, ["merge", "--no-ff", "--no-edit", "--", "feature/ui"]);
  assert.equal(operation.display, "git merge --no-ff --no-edit -- feature/ui");
});

test("release operations reject unsafe branch arguments", () => {
  assert.throws(() => getGitOperation("feature/--upload-pack=evil", "development"), /safe branch/);
  assert.throws(() => getGitOperation("feature/ui", "development..prod"), /safe branch/);
});
