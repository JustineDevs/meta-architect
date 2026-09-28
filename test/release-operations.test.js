import assert from "node:assert/strict";
import test from "node:test";
import { getGitOperation } from "../src/release-operations.js";

test("release operations produce an explicit safe merge command", () => {
  const operation = getGitOperation("dev", "main");
  assert.deepEqual(operation.args, ["merge", "--no-ff", "--no-edit", "--", "dev"]);
  assert.equal(operation.display, "git merge --no-ff --no-edit -- dev");
});

test("release operations reject unsafe branch arguments", () => {
  assert.throws(() => getGitOperation("dev/--upload-pack=evil", "main"), /safe branch/);
  assert.throws(() => getGitOperation("dev", "main..prod"), /safe branch/);
});

test("release operations reject every non-canonical branch transition", () => {
  assert.throws(() => getGitOperation("feature/ui", "dev"), /only the dev -> main/);
  assert.throws(() => getGitOperation("dev", "release/0.15.3"), /only the dev -> main/);
});
