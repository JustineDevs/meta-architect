import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  choosePrelaunchInstall,
  detectPrelaunchTargets,
  installPrelaunchSelection,
} from "../src/prelaunch.js";
import { createTestNamespace } from "../src/test-fixtures.js";

test("pre-launch detection exposes project and user installation paths", async () => {
  const root = createTestNamespace("prelaunch-detection");
  await fs.mkdir(path.join(root, ".cursor"), { recursive: true });
  try {
    const targets = await detectPrelaunchTargets(root);
    const cursor = targets.find((target) => target.id === "cursor");
    assert.equal(cursor?.surface, "ide");
    assert.equal(cursor?.projectDetected, true);
    assert.match(cursor?.global ?? "", /\.agents[\\/]skills$/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("non-interactive pre-launch does not write or prompt", async () => {
  const root = createTestNamespace("prelaunch-noninteractive");
  try {
    assert.equal(await choosePrelaunchInstall({ cwd: root, interactive: false }), null);
    assert.equal(
      await fs
        .access(path.join(root, ".ma", "prelaunch.json"))
        .then(() => true)
        .catch(() => false),
      false,
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("pre-launch selection installs a project compatibility entrypoint and persists scope", async () => {
  const root = createTestNamespace("prelaunch-install");
  try {
    await installPrelaunchSelection(
      { schemaVersion: "0.1.0", scope: "project", targets: ["cursor"] },
      root,
    );
    const skill = path.join(root, ".agents", "skills", "meta-architect", "SKILL.md");
    assert.match(await fs.readFile(skill, "utf8"), /Meta-Architect host compatibility entrypoint/);
    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(root, ".ma", "prelaunch.json"), "utf8")),
      { schemaVersion: "0.1.0", scope: "project", targets: ["cursor"] },
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("project Codex selection installs the complete lane skill and support bundle", async () => {
  const root = createTestNamespace("prelaunch-codex-project");
  try {
    await installPrelaunchSelection(
      { schemaVersion: "0.1.0", scope: "project", targets: ["codex"] },
      root,
    );
    await fs.access(path.join(root, ".agents", "skills", "maestro", "SKILL.md"));
    await fs.access(path.join(root, ".agents", "skills", "arch", "SKILL.md"));
    await fs.access(path.join(root, ".ma", "support-bundle", "mcp", "servers.json"));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
