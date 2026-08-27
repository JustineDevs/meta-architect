import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  configureObsidianVault,
  listObsidianNotes,
  loadObsidianVaultConfig,
  resolveObsidianVault,
} from "../src/runtime/obsidian-integration-core.js";
import { createTestNamespace } from "../src/test-fixtures.js";

test("Obsidian vault resolution persists and honors explicit, env, then stored paths", async () => {
  const root = createTestNamespace("obsidian-config");
  const vault = path.join(root, "vault");
  await fs.mkdir(vault, { recursive: true });
  const previousRoot = process.env.MA_ROOT;
  const previousVault = process.env.MA_OBSIDIAN_VAULT;
  process.env.MA_ROOT = root;
  delete process.env.MA_OBSIDIAN_VAULT;
  try {
    await configureObsidianVault(vault);
    assert.equal((await loadObsidianVaultConfig()).vaultPath, path.resolve(vault));
    assert.equal(await resolveObsidianVault(), await fs.realpath(vault));
    assert.deepEqual((await listObsidianNotes()).notes, []);
    const explicit = path.join(root, "explicit");
    await fs.mkdir(explicit);
    process.env.MA_OBSIDIAN_VAULT = explicit;
    assert.equal(await resolveObsidianVault(), await fs.realpath(explicit));
  } finally {
    if (previousRoot === undefined) delete process.env.MA_ROOT;
    else process.env.MA_ROOT = previousRoot;
    if (previousVault === undefined) delete process.env.MA_OBSIDIAN_VAULT;
    else process.env.MA_OBSIDIAN_VAULT = previousVault;
    await fs.rm(root, { recursive: true, force: true });
  }
});
