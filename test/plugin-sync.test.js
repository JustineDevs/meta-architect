import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { verifyPluginSkills } from "../scripts/plugin-sync.js";
import { createTestNamespace, removeTestNamespace } from "../src/test-fixtures.js";

test("plugin mirror verification detects content and mode drift", async () => {
  const root = createTestNamespace("plugin-sync");
  const source = path.join(root, "source");
  const mirror = path.join(root, "mirror");
  const sourceFile = path.join(source, "example", "SKILL.md");
  const mirrorFile = path.join(mirror, "example", "SKILL.md");
  try {
    await fs.mkdir(path.dirname(sourceFile), { recursive: true });
    await fs.mkdir(path.dirname(mirrorFile), { recursive: true });
    await fs.writeFile(sourceFile, "same\n", { mode: 0o644 });
    await fs.writeFile(mirrorFile, "same\n", { mode: 0o644 });
    await verifyPluginSkills(source, mirror);

    await fs.writeFile(mirrorFile, "different\n");
    await assert.rejects(() => verifyPluginSkills(source, mirror), /content mismatch/);
    await fs.writeFile(mirrorFile, "same\n");
    await fs.chmod(mirrorFile, 0o755);
    await assert.rejects(() => verifyPluginSkills(source, mirror), /mode mismatch/);
    await fs.chmod(mirrorFile, 0o644);
    await fs.writeFile(path.join(mirror, "example", "stale.md"), "stale\n");
    await assert.rejects(() => verifyPluginSkills(source, mirror), /file set mismatch/);
    await fs.rm(path.join(mirror, "example", "stale.md"));
    await fs.rm(mirrorFile);
    await assert.rejects(() => verifyPluginSkills(source, mirror), /file set mismatch/);
  } finally {
    await removeTestNamespace(root);
  }
});
