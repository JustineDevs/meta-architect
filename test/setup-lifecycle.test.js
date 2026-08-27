import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  inspectRuntimeStateHealth,
  withRuntimeStateLock,
  writeTextAtomically,
} from "../src/fs-utils.js";
import {
  compactRuntimeState,
  inspectSetupDrift,
  pruneRuntimeLogs,
  rollbackSetup,
  withSetupLock,
  writeJsonAtomically,
  writeSetupReceipt,
} from "../src/setup-lifecycle.js";
import { createTestNamespace, removeTestNamespace } from "../src/test-fixtures.js";

const execFileAsync = promisify(execFile);

test("setup receipts rollback only artifacts created by Meta-Architect", async (t) => {
  const root = createTestNamespace("setup-lifecycle");
  t.after(() => removeTestNamespace(root));
  await fs.mkdir(path.join(root, "created-dir"), { recursive: true });
  await fs.writeFile(path.join(root, "created.md"), "generated\n");
  await fs.writeFile(path.join(root, "user.md"), "keep\n");
  await writeSetupReceipt(root, {
    directories: [{ path: "created-dir", kind: "directory", status: "created" }],
    files: [
      { path: "created.md", kind: "file", status: "created" },
      { path: "user.md", kind: "file", status: "existing" },
    ],
  });
  const result = await rollbackSetup(root);
  assert.equal(result.status, "rolled-back");
  await assert.rejects(fs.access(path.join(root, "created.md")));
  await assert.rejects(fs.access(path.join(root, "created-dir")));
  await fs.access(path.join(root, "user.md"));
});

test("setup receipts preserve created ownership across reruns", async (t) => {
  const root = createTestNamespace("setup-receipt-rerun");
  t.after(() => removeTestNamespace(root));
  await fs.writeFile(path.join(root, "created.md"), "generated\n");
  await writeSetupReceipt(root, {
    files: [{ path: "created.md", kind: "file", status: "created" }],
  });
  await writeSetupReceipt(root, {
    files: [{ path: "created.md", kind: "file", status: "existing" }],
  });
  await rollbackSetup(root);
  await assert.rejects(fs.access(path.join(root, "created.md")));
});

test("setup rollback dry-run reports owned artifacts without deleting them", async (t) => {
  const root = createTestNamespace("setup-rollback-dry-run");
  t.after(() => removeTestNamespace(root));
  await fs.writeFile(path.join(root, "created.md"), "generated\n");
  await writeSetupReceipt(root, {
    files: [{ path: "created.md", kind: "file", status: "created" }],
  });
  const result = await rollbackSetup(root, { dryRun: true });
  assert.equal(result.status, "dry-run");
  assert.deepEqual(result.removed, ["created.md"]);
  await fs.access(path.join(root, "created.md"));
  await fs.access(path.join(root, ".ma", "state", "setup-receipt.json"));
});

test("setup rejects symlinked managed roots", async (t) => {
  if (process.platform === "win32") return;
  const root = createTestNamespace("setup-symlink-root");
  const outside = createTestNamespace("setup-symlink-outside");
  t.after(async () => {
    await removeTestNamespace(root);
    await removeTestNamespace(outside);
  });
  await fs.symlink(outside, path.join(root, ".ma"));
  await assert.rejects(() => withSetupLock(root, async () => {}), /symlink/);
  assert.deepEqual(
    (await fs.readdir(outside)).filter((entry) => entry !== ".active"),
    [],
  );
});

test("setup lock rejects concurrent setup and releases after failure", async (t) => {
  const root = createTestNamespace("setup-lock");
  t.after(() => removeTestNamespace(root));
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  const first = withSetupLock(root, async () => held);
  const ownerPath = path.join(root, ".ma", "state", ".setup.lock", "owner.json");
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await fs.access(ownerPath);
      break;
    } catch (error) {
      if (attempt === 99) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
  }
  await assert.rejects(
    withSetupLock(root, async () => {}),
    /already running/,
  );
  release();
  await first;
  await withSetupLock(root, async () => {});
});

test("atomic JSON writes and log pruning keep bounded state", async (t) => {
  const root = createTestNamespace("setup-state");
  t.after(() => removeTestNamespace(root));
  const statePath = path.join(root, ".ma", "state.json");
  await writeJsonAtomically(statePath, { schemaVersion: "0.1.0", ok: true });
  assert.deepEqual(JSON.parse(await fs.readFile(statePath, "utf8")), {
    schemaVersion: "0.1.0",
    ok: true,
  });
  const runtime = path.join(root, ".ma", "runtime");
  await fs.mkdir(runtime, { recursive: true });
  await fs.writeFile(path.join(runtime, "old.log"), "x".repeat(10));
  await fs.writeFile(path.join(runtime, "new.log"), "y".repeat(10));
  const result = await pruneRuntimeLogs(runtime, { maxBytes: 10, maxFiles: 1 });
  assert.equal(result.retained, 1);
  assert.equal(result.bytes, 10);
  assert.equal((await fs.readdir(runtime)).length, 1);
});

test("runtime writes serialize and recover stale locks", async (t) => {
  const root = createTestNamespace("runtime-lock");
  t.after(() => removeTestNamespace(root));
  const target = path.join(root, ".ma", "state", "state.txt");
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  const first = withRuntimeStateLock(target, async () => held);
  const lockPath = path.join(root, ".ma", "state", ".runtime-state.lock");
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await fs.access(lockPath);
      break;
    } catch (error) {
      if (attempt === 99) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
  }
  await assert.rejects(
    withRuntimeStateLock(target, async () => {}),
    /runtime state is busy/,
  );
  release();
  await first;

  await fs.mkdir(lockPath, { recursive: true });
  await fs.writeFile(
    path.join(lockPath, "owner.json"),
    JSON.stringify({ pid: 999999, createdAt: 0 }),
  );
  await fs.utimes(lockPath, new Date(0), new Date(0));
  await writeTextAtomically(target, "atomic\n");
  assert.equal(await fs.readFile(target, "utf8"), "atomic\n");
  const findings = await inspectRuntimeStateHealth(root);
  assert.equal(
    findings.some((finding) => finding.type === "corrupt-json"),
    false,
  );
  const receipts = await fs.readdir(path.join(root, ".ma", "state", "recovery-receipts"));
  assert.equal(receipts.length, 1);
});

test("runtime compaction retains recent records and archives stale metadata", async (t) => {
  const root = createTestNamespace("runtime-compaction");
  t.after(() => removeTestNamespace(root));
  const runtime = path.join(root, ".ma", "runtime");
  const receipts = path.join(root, ".ma", "hooks", "receipts");
  await fs.mkdir(runtime, { recursive: true });
  await fs.mkdir(receipts, { recursive: true });
  const recent = path.join(runtime, "recent.log");
  const stale = path.join(receipts, "stale.json");
  await fs.writeFile(recent, "keep\n");
  await fs.writeFile(stale, JSON.stringify({ secret: "must-not-be-archived" }));
  await fs.utimes(stale, new Date(0), new Date(0));
  const result = await compactRuntimeState(root, { maxAgeMs: 1000, maxBytes: 1024, maxFiles: 10 });
  assert.equal(result.archived, 1);
  await fs.access(recent);
  await assert.rejects(fs.access(stale));
  const summary = await fs.readFile(path.join(root, result.archivePath), "utf8");
  assert.match(summary, /stale\.json/);
  assert.doesNotMatch(summary, /must-not-be-archived/);
});

test("setup drift inspection reports protected managed files", async (t) => {
  const root = createTestNamespace("setup-drift");
  t.after(() => removeTestNamespace(root));
  await writeSetupReceipt(root, {
    files: [{ path: ".codex/hooks.json", kind: "file", status: "skipped" }],
  });
  assert.deepEqual(await inspectSetupDrift(root), [
    { path: ".codex/hooks.json", status: "skipped" },
  ]);
});

test("setup rollback CLI uses MA_ROOT", async (t) => {
  const root = createTestNamespace("setup-cli-root");
  t.after(() => removeTestNamespace(root));
  const cli = fileURLToPath(new URL("../bin/ma.js", import.meta.url));
  await execFileAsync(process.execPath, [cli, "setup", "--json"], {
    cwd: process.cwd(),
    env: { ...process.env, MA_ROOT: root },
  });
  await execFileAsync(process.execPath, [cli, "setup", "--rollback"], {
    cwd: process.cwd(),
    env: { ...process.env, MA_ROOT: root },
  });
  await assert.rejects(fs.access(path.join(root, ".ma", "state", "setup-receipt.json")));
});

test("setup embeds project context only when an Obsidian vault is configured", async (t) => {
  const root = createTestNamespace("setup-obsidian-project");
  const vault = createTestNamespace("setup-obsidian-vault");
  t.after(async () => {
    await removeTestNamespace(root);
    await removeTestNamespace(vault);
  });
  const cli = fileURLToPath(new URL("../bin/ma.js", import.meta.url));
  const result = await execFileAsync(process.execPath, [cli, "setup", "--json"], {
    cwd: process.cwd(),
    env: { ...process.env, MA_ROOT: root, MA_OBSIDIAN_VAULT: vault },
  });
  const report = JSON.parse(result.stdout);
  assert.equal(report.integrations[0].kind, "obsidian");
  assert.equal(report.integrations[0].records_as, "vault_context");
  const note = path.join(
    vault,
    "Meta-Architect",
    "Projects",
    path.basename(root),
    "Project Context.md",
  );
  const map = path.join(vault, "Meta-Architect", "Map of Content.md");
  await fs.access(note);
  await fs.access(map);
  assert.match(await fs.readFile(note, "utf8"), /MA Map of Content/);
  assert.match(await fs.readFile(map, "utf8"), /Project Context/);
});
