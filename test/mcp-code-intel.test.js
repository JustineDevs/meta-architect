import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { listRepoFiles, readRepoExcerpt, searchRepoText } from "../mcp/local/code-intel.js";
import { createTestNamespace } from "../src/test-fixtures.js";

test("code intel respects gitignore, generated artifacts, binary files, and path boundaries", async () => {
  const root = createTestNamespace("mcp-code-intel");
  const previousRoot = process.env.MA_ROOT;
  process.env.MA_ROOT = root;
  try {
    await fs.mkdir(path.join(root, "src"), { recursive: true });
    await fs.mkdir(path.join(root, "dist"), { recursive: true });
    await fs.mkdir(path.join(root, "ignored"), { recursive: true });
    await fs.writeFile(path.join(root, ".gitignore"), "ignored/\ncustom-*.ts\n.venv/\n");
    await fs.writeFile(path.join(root, "src", "index.ts"), "export const answer = 42;\n");
    await fs.writeFile(path.join(root, "ignored", "secret.ts"), "do not expose\n");
    await fs.writeFile(path.join(root, "custom-secret.ts"), "do not expose\n");
    await fs.mkdir(path.join(root, ".venv"), { recursive: true });
    await fs.writeFile(path.join(root, ".venv", "python.py"), "do not expose\n");
    await fs.writeFile(path.join(root, "dist", "bundle.js"), "generated\n");
    await fs.mkdir(path.join(root, "build"), { recursive: true });
    await fs.writeFile(path.join(root, "build", "bundle.js"), "generated\n");
    await fs.writeFile(path.join(root, "image.png"), Buffer.from([0, 1, 2, 3]));
    await fs.writeFile(path.join(root, "large.txt"), "x".repeat(1024 * 1024 + 1));

    const files = await listRepoFiles(50);
    assert.deepEqual(files.sort(), [".gitignore", "src/index.ts"]);
    assert.deepEqual(await searchRepoText("answer"), [
      { file: "src/index.ts", line: 1, text: "export const answer = 42;" },
    ]);
    await assert.rejects(() => readRepoExcerpt("../outside.ts"), /inside the repository/);
    await assert.rejects(() => readRepoExcerpt("image.png"), /generated or binary/);
  } finally {
    if (previousRoot === undefined) delete process.env.MA_ROOT;
    else process.env.MA_ROOT = previousRoot;
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("code intel rejects repository symlinks", async (t) => {
  if (process.platform === "win32") return;
  const root = createTestNamespace("mcp-code-intel-symlink");
  const outside = createTestNamespace("mcp-code-intel-outside");
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  });
  await fs.writeFile(path.join(outside, "secret.ts"), "secret\n");
  await fs.symlink(path.join(outside, "secret.ts"), path.join(root, "linked.ts"));
  const previousRoot = process.env.MA_ROOT;
  process.env.MA_ROOT = root;
  try {
    assert.deepEqual(await listRepoFiles(50), []);
    await assert.rejects(() => readRepoExcerpt("linked.ts"), /symlink|bounded/);
  } finally {
    if (previousRoot === undefined) delete process.env.MA_ROOT;
    else process.env.MA_ROOT = previousRoot;
  }
});
