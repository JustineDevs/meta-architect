import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { cleanupTemporaryNpmConfig, createTemporaryNpmConfig } from "../scripts/setup-npmrc.js";
import { inspectWorkspaceNpmrc } from "../src/bootstrap.js";
import { createTestNamespace, removeTestNamespace } from "../src/test-fixtures.js";

test("npm auth config is temporary, owner-only, and outside the workspace", async () => {
  const root = createTestNamespace("npmrc");
  try {
    const configPath = await createTemporaryNpmConfig({
      token: "test-token",
      scope: "@jstn-sdk",
      tempRoot: root,
    });
    const stat = await fs.stat(configPath);
    const content = await fs.readFile(configPath, "utf8");
    assert.equal(stat.mode & 0o777, 0o600);
    assert.match(content, /registry=https:\/\/registry\.npmjs\.org\//);
    assert.match(content, /@jstn-sdk:registry=/);
    assert.match(content, /:_authToken=test-token/);
    assert.equal(path.dirname(configPath), root);
    assert.equal(await cleanupTemporaryNpmConfig(configPath), true);
    await assert.rejects(() => fs.stat(configPath), { code: "ENOENT" });
  } finally {
    await removeTestNamespace(root);
  }
});

test("doctor detects token-bearing workspace npmrc without exposing its value", async () => {
  const root = createTestNamespace("npmrc-doctor");
  const previousRoot = process.env.MA_ROOT;
  process.env.MA_ROOT = root;
  try {
    await fs.writeFile(path.join(root, ".npmrc"), "//registry.example/:_authToken=secret-token\n");
    const status = await inspectWorkspaceNpmrc();
    assert.equal(status.kind, "WARN");
    assert.match(status.detail, /token-bearing .npmrc detected/);
    assert.doesNotMatch(status.detail, /secret-token/);
  } finally {
    if (previousRoot === undefined) delete process.env.MA_ROOT;
    else process.env.MA_ROOT = previousRoot;
    await removeTestNamespace(root);
  }
});
