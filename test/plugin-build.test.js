import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildPlugins } from "../scripts/plugin-build.js";

const require = createRequire(import.meta.url);
const packageVersion = require("../package.json").version;

const targets = [
  "codex",
  "claude-code",
  "cursor",
  "antigravity",
  "gemini-cli",
  "opencode",
  "pi",
  "openclaw",
  "cline",
  "continue",
  "goose",
];

test("builds native or portable publish artifacts for every supported host", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ma-plugin-build-"));
  try {
    await buildPlugins({ output: root, targets });
    for (const target of targets) {
      const output = path.join(root, target);
      const manifest = JSON.parse(
        await fs.readFile(path.join(output, "BUILD-MANIFEST.json"), "utf8"),
      );
      assert.equal(manifest.target, target);
      assert.match(manifest.support, /^(native|portable)$/);
      assert.equal(manifest.version, packageVersion);
    }
    for (const skillsPath of [
      ["codex", "skills"],
      ["claude-code", "plugins", "meta-architect", "skills"],
      ["cursor", "plugins", "meta-architect", "skills"],
      ["antigravity", "skills"],
      ["gemini-cli", "skills"],
      ["opencode", ".opencode", "skills"],
      ["pi", "skills"],
      ["openclaw", "skills"],
      ["cline", ".cline", "skills"],
      ["continue", "skills"],
      ["goose", "skills"],
    ]) {
      await fs.access(path.join(root, ...skillsPath));
    }
    await fs.access(
      path.join(root, "claude-code", "plugins", "meta-architect", ".claude-plugin", "plugin.json"),
    );
    await fs.access(
      path.join(root, "cursor", "plugins", "meta-architect", ".cursor-plugin", "plugin.json"),
    );
    await fs.access(path.join(root, "gemini-cli", "gemini-extension.json"));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("repository is a directly installable Claude Code marketplace", async () => {
  const marketplace = JSON.parse(await fs.readFile(".claude-plugin/marketplace.json", "utf8"));
  const pluginPath = path.join("plugins", "meta-architect", ".claude-plugin", "plugin.json");
  const plugin = JSON.parse(await fs.readFile(pluginPath, "utf8"));
  const obsidianManifest = JSON.parse(
    await fs.readFile("plugins/meta-architect/obsidian/manifest.json", "utf8"),
  );

  assert.equal(marketplace.name, "meta-architect");
  assert.equal(marketplace.owner.email, "justinedevs@jstn.site");
  assert.deepEqual(marketplace.plugins, [
    {
      name: "meta-architect",
      source: "./plugins/meta-architect",
      description: "Meta-Architect gated workflow skills for Claude Code.",
    },
  ]);
  assert.equal(plugin.name, "meta-architect");
  assert.equal(plugin.version, packageVersion);
  assert.equal(obsidianManifest.version, packageVersion);
});
