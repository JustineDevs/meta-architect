import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createTestNamespace } from "../src/test-fixtures.js";

test("Obsidian CLI preserves file/stdin content and supports dry-run", async () => {
  const root = createTestNamespace("obsidian-cli-input");
  const vault = path.join(root, "vault");
  const input = path.join(root, "note.md");
  const content = "---\ntitle: Exact\n---\n\n```ts\nconst value = 1;\n```\n[[Map of Content]]\n";
  await fs.mkdir(vault, { recursive: true });
  await fs.writeFile(input, content);
  const env = { ...process.env, MA_ROOT: root, MA_SKIP_AUTO_INSTALL: "1" };
  const cli = path.join(process.cwd(), "bin/ma.js");
  const created = spawnSync(
    process.execPath,
    [cli, "obsidian", "create", vault, "Docs/exact.md", "--file", input],
    { env, cwd: root, encoding: "utf8" },
  );
  assert.equal(created.status, 0, created.stderr);
  assert.equal(await fs.readFile(path.join(vault, "Docs/exact.md"), "utf8"), content);

  const dryRun = spawnSync(
    process.execPath,
    [cli, "obsidian", "update", vault, "Docs/exact.md", "--stdin", "--dry-run"],
    { env, cwd: root, input: content, encoding: "utf8" },
  );
  assert.equal(dryRun.status, 0, dryRun.stderr);
  assert.equal(JSON.parse(dryRun.stdout.trim()).status, "unchanged");
  await fs.rm(root, { recursive: true, force: true });
});
