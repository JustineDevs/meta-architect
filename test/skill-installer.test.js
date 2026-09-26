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

test("support bundle installation adopts matching legacy assets without taking ownership", async () => {
  const root = createTestNamespace("support-bundle-legacy-assets");
  try {
    const first = await installSupportBundle({ targetRoot: root });
    assert.ok(first.installed.length > 0);
    await fs.rm(path.join(root, ".ma-install-receipt.json"), { force: true });
    await fs.rm(path.join(root, "asset-manifest.json"), { force: true });

    const second = await installSupportBundle({ targetRoot: root });
    assert.equal(second.conflicts.length, 0);
    assert.ok(second.installed.length > 0);
    assert.ok(second.installed.every((asset) => asset.adopted === true));

    const rollback = await rollbackInstalledAssets({ targetRoot: root, kind: "support" });
    assert.equal(rollback.status, "rolled-back");
    await fs.access(path.join(root, "mcp", "servers.json"));
  } finally {
    await removeTestNamespace(root);
  }
});

test("support bundle installation upgrades a legacy empty receipt with backups", async () => {
  const root = createTestNamespace("support-bundle-legacy-receipt");
  try {
    const first = await installSupportBundle({ targetRoot: root });
    const legacyReceiptPath = path.join(root, ".ma-install-receipt.json");
    const legacyReceipt = JSON.parse(await fs.readFile(legacyReceiptPath, "utf8"));
    legacyReceipt.assets = [];
    legacyReceipt.installed = [];
    legacyReceipt.managedPaths = [];
    legacyReceipt.conflicts = first.installed.map((asset) => ({
      name: asset.name,
      dest: asset.dest,
      reason: "existing-unmanaged-path",
    }));
    await fs.writeFile(legacyReceiptPath, `${JSON.stringify(legacyReceipt, null, 2)}\n`);

    const upgraded = await installSupportBundle({ targetRoot: root });
    assert.equal(upgraded.conflicts.length, 0);
    assert.ok(upgraded.backups.length > 0);
    assert.ok(upgraded.installed.length > 0);
  } finally {
    await removeTestNamespace(root);
  }
});
