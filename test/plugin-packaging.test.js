import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assertSupportedSkillInvocation,
  findUnsupportedLocalSkillReferences,
  validateLocalMarketplace,
  validatePortablePlugin,
} from "../src/plugin-packaging.js";

test("portable plugin manifest and repo marketplace validate", async () => {
  const manifest = await validatePortablePlugin(path.resolve("plugins/meta-architect"));
  assert.equal(manifest.name, "meta-architect");
  const marketplace = await validateLocalMarketplace(
    path.resolve(".agents/plugins/marketplace.json"),
    { sourceRoot: path.resolve(".") },
  );
  assert.equal(marketplace.plugins[0].source.path, "./plugins/meta-architect");
});

test("unsupported absolute skill links produce a ChatGPT Desktop remediation", () => {
  const invocation = "[$maestro](/home/justine/.codex/skills/maestro/SKILL.md)";
  assert.deepEqual(findUnsupportedLocalSkillReferences(invocation), [
    "/home/justine/.codex/skills/maestro/SKILL.md",
  ]);
  assert.throws(() => assertSupportedSkillInvocation(invocation), {
    message: /ChatGPT Desktop cannot resolve a Codex CLI filesystem link.*marketplace/,
  });
  assert.doesNotThrow(() => assertSupportedSkillInvocation("Use $maestro for this task."));
});

test("absolute local marketplace paths are rejected", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ma-plugin-validation-"));
  try {
    const marketplacePath = path.join(root, "marketplace.json");
    await fs.writeFile(
      marketplacePath,
      JSON.stringify({
        name: "bad-marketplace",
        plugins: [
          {
            name: "meta-architect",
            source: { source: "local", path: "/home/justine/.codex/skills/maestro" },
          },
        ],
      }),
    );
    await assert.rejects(
      () => validateLocalMarketplace(marketplacePath),
      /Absolute filesystem paths are not portable to ChatGPT Desktop/,
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("portable plugin validation rejects symlinked skill mirrors", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ma-plugin-symlink-validation-"));
  try {
    await fs.mkdir(path.join(root, "skills", "maestro"), { recursive: true });
    await fs.writeFile(
      path.join(root, "plugin.json"),
      JSON.stringify({
        $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
        name: "test-plugin",
        version: "0.0.0",
        description: "test",
      }),
    );
    await fs.writeFile(
      path.join(root, "skills", "maestro", "SKILL.md"),
      "---\nname: maestro\n---\n",
    );
    await fs.symlink("maestro", path.join(root, "skills", "linked"), "dir");
    await assert.rejects(
      () => validatePortablePlugin(root),
      /Portable plugin contains a symlink.*Materialize the skill mirror/,
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
