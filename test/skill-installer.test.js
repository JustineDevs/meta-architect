import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  installSkills,
  installSupportBundle,
  rollbackInstalledAssets,
} from "../src/skill-installer.js";
import { createTestNamespace, removeTestNamespace } from "../src/test-fixtures.js";

test("skill installation records ownership, preserves conflicts, and rolls back", async () => {
  const root = createTestNamespace("skill-installer");
  try {
    const conflict = path.join(root, "arch", "SKILL.md");
    await fs.mkdir(path.dirname(conflict), { recursive: true });
    await fs.writeFile(conflict, "user-owned\n");
    const first = await installSkills({ targetRoot: root });
    assert.ok(first.conflicts.some((entry) => entry.name === "arch"));
    const receipt = JSON.parse(
      await fs.readFile(path.join(root, ".ma-install-receipt.json"), "utf8"),
    );
    assert.equal(receipt.record_type, "codex_skill_install_receipt");
    assert.ok(receipt.packageVersion);

    const second = await installSkills({ targetRoot: root });
    assert.ok(second.backups.length > 0);
    const rollback = await rollbackInstalledAssets({ targetRoot: root });
    assert.equal(rollback.status, "rolled-back");
    assert.equal(await fs.readFile(conflict, "utf8"), "user-owned\n");
  } finally {
    await removeTestNamespace(root);
  }
});

test("support bundle installation records a version receipt and rolls back", async () => {
  const root = createTestNamespace("support-bundle-installer");
  try {
    const first = await installSupportBundle({ targetRoot: root });
    assert.ok(first.installed.length > 0);
    const receipt = JSON.parse(
      await fs.readFile(path.join(root, ".ma-install-receipt.json"), "utf8"),
    );
    assert.equal(receipt.record_type, "codex_support_bundle_install_receipt");
    await installSupportBundle({ targetRoot: root });
    const rollback = await rollbackInstalledAssets({ targetRoot: root, kind: "support" });
    assert.equal(rollback.status, "rolled-back");
    await assert.rejects(fs.access(path.join(root, "asset-manifest.json")));
  } finally {
    await removeTestNamespace(root);
  }
});
