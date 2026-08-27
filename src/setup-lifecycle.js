import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const RECEIPT_RELATIVE_PATH = path.join(".ma", "state", "setup-receipt.json");
const LOCK_RELATIVE_PATH = path.join(".ma", "state", ".setup.lock");
const MAX_RUNTIME_LOG_BYTES = 5 * 1024 * 1024;
const MAX_RUNTIME_LOG_FILES = 100;
const MANAGED_ROOTS = [".ma", ".codex", "scripts", "mcp", "docs", "sprint"];

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function within(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertRepoPath(repoRoot, relative) {
  const target = path.resolve(repoRoot, relative);
  if (!within(path.resolve(repoRoot), target))
    throw new Error(`Setup path escapes repository: ${relative}`);
  return target;
}

export async function assertNoSymlinkComponents(root, target) {
  const rootStat = await fs.lstat(path.resolve(root));
  if (rootStat.isSymbolicLink()) {
    throw new Error(`Setup root cannot be a symlink: ${root}`);
  }
  const relative = path.relative(path.resolve(root), path.resolve(target));
  let current = path.resolve(root);
  for (const component of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    const stat = await fs.lstat(current).catch((error) => {
      if (error?.code === "ENOENT") return null;
      throw error;
    });
    if (stat?.isSymbolicLink())
      throw new Error(`Setup path cannot traverse a symlink: ${relative}`);
  }
}

export async function writeJsonAtomically(target, value) {
  const absolute = path.resolve(target);
  const temporary = `${absolute}.tmp-${randomUUID()}`;
  try {
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    await fs.rename(temporary, absolute);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

export async function withSetupLock(repoRoot, action) {
  const lockPath = assertRepoPath(repoRoot, LOCK_RELATIVE_PATH);
  await assertNoSymlinkComponents(repoRoot, path.dirname(lockPath));
  await fs.mkdir(path.dirname(lockPath), { recursive: true });
  for (;;) {
    try {
      await fs.mkdir(lockPath);
      await fs.writeFile(
        path.join(lockPath, "owner.json"),
        `${JSON.stringify({ pid: process.pid, createdAt: Date.now() })}\n`,
      );
      break;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const ownerText = await fs
        .readFile(path.join(lockPath, "owner.json"), "utf8")
        .catch(() => null);
      const lockStat = await fs.stat(lockPath).catch(() => null);
      let owner = null;
      if (ownerText) {
        try {
          owner = JSON.parse(ownerText);
        } catch {
          throw new Error(
            "Meta-Architect setup lock is unreadable; remove it only after confirming no setup is running",
          );
        }
      }
      const stale = owner
        ? !Number.isInteger(owner.pid) || !isProcessAlive(owner.pid)
        : Boolean(lockStat && Date.now() - lockStat.mtimeMs > 60 * 60 * 1000);
      if (!stale) throw new Error("Meta-Architect setup is already running");
      await fs.rm(lockPath, { recursive: true, force: true });
    }
  }
  try {
    return await action();
  } finally {
    await fs.rm(lockPath, { recursive: true, force: true });
  }
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function listManagedArtifacts(repoRoot) {
  const root = path.resolve(repoRoot);
  const artifacts = new Map();
  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true }).catch((error) => {
      if (error?.code === "ENOENT") return [];
      throw error;
    });
    for (const entry of entries) {
      if (entry.name === ".setup.lock" || entry.name.includes(".tmp-")) continue;
      const target = path.join(current, entry.name);
      const relative = path.relative(root, target);
      if (entry.isSymbolicLink()) {
        throw new Error(`Managed setup path cannot contain a symlink: ${relative}`);
      }
      artifacts.set(relative, entry.isDirectory() ? "directory" : "file");
      if (entry.isDirectory()) await walk(target);
    }
  }
  for (const relative of MANAGED_ROOTS) {
    const target = path.join(root, relative);
    await assertNoSymlinkComponents(root, target);
    if (await exists(target)) {
      artifacts.set(relative, "directory");
      await walk(target);
    }
  }
  return artifacts;
}

export async function writeSetupReceipt(repoRoot, report) {
  const receiptPath = assertRepoPath(repoRoot, RECEIPT_RELATIVE_PATH);
  await assertNoSymlinkComponents(repoRoot, path.dirname(receiptPath));
  const artifacts = [...(report.directories ?? []), ...(report.files ?? [])].map((entry) => ({
    path: entry.path,
    kind: entry.kind,
    status: entry.status,
    created: entry.status === "created",
  }));
  const previous = await readSetupReceipt(repoRoot);
  const previousCreated = new Set(
    (previous.artifacts ?? [])
      .filter((artifact) => artifact.created)
      .map((artifact) => artifact.path),
  );
  const artifactsByPath = new Map(
    (previous.artifacts ?? []).map((artifact) => [artifact.path, artifact]),
  );
  for (const artifact of artifacts) {
    const old = artifactsByPath.get(artifact.path);
    artifactsByPath.set(artifact.path, {
      ...artifact,
      created: artifact.created || old?.created === true,
    });
  }
  const receipt = {
    schemaVersion: "0.1.0",
    record_type: "setup_receipt",
    generatedAt: new Date().toISOString(),
    managedBy: "@jstn-sdk/ma",
    artifacts: [...artifactsByPath.values()].map((artifact) => ({
      ...artifact,
      created: artifact.created || previousCreated.has(artifact.path),
    })),
  };
  await writeJsonAtomically(receiptPath, receipt);
  return { path: path.relative(repoRoot, receiptPath), receipt };
}

async function readSetupReceipt(repoRoot) {
  const receiptPath = assertRepoPath(repoRoot, RECEIPT_RELATIVE_PATH);
  await assertNoSymlinkComponents(repoRoot, receiptPath);
  try {
    const value = JSON.parse(await fs.readFile(receiptPath, "utf8"));
    if (
      !value ||
      typeof value !== "object" ||
      value.schemaVersion !== "0.1.0" ||
      value.record_type !== "setup_receipt" ||
      value.managedBy !== "@jstn-sdk/ma" ||
      typeof value.generatedAt !== "string" ||
      !Array.isArray(value.artifacts) ||
      value.artifacts.some(
        (artifact) =>
          !artifact ||
          typeof artifact.path !== "string" ||
          !["file", "directory"].includes(artifact.kind) ||
          !["created", "existing", "refreshed", "skipped", "warning", "failed"].includes(
            artifact.status,
          ) ||
          typeof artifact.created !== "boolean",
      )
    ) {
      throw new Error("setup receipt schema invalid");
    }
    for (const artifact of value.artifacts) assertRepoPath(repoRoot, artifact.path);
    return value;
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw new Error(`Setup receipt is corrupt; repair or remove ${RECEIPT_RELATIVE_PATH}`, {
      cause: error,
    });
  }
}

export async function assertSetupReceiptHealthy(repoRoot) {
  await readSetupReceipt(repoRoot);
}

export async function inspectSetupDrift(repoRoot) {
  const receipt = await readSetupReceipt(repoRoot);
  return (receipt.artifacts ?? [])
    .filter((artifact) => ["skipped", "warning", "failed"].includes(artifact.status))
    .map((artifact) => ({ path: artifact.path, status: artifact.status }));
}

async function rollbackSetupUnlocked(repoRoot, { dryRun = false } = {}) {
  const receiptPath = assertRepoPath(repoRoot, RECEIPT_RELATIVE_PATH);
  if (!(await exists(receiptPath))) return { status: "nothing-to-rollback", removed: [] };
  const receipt = await readSetupReceipt(repoRoot);
  const removed = [];
  const artifacts = (receipt.artifacts ?? [])
    .filter((artifact) => artifact.created)
    .sort((left, right) => right.path.split(path.sep).length - left.path.split(path.sep).length);
  for (const artifact of artifacts) {
    const target = assertRepoPath(repoRoot, artifact.path);
    await assertNoSymlinkComponents(repoRoot, target);
    if (artifact.kind === "directory") {
      const entries = await fs.readdir(target).catch(() => null);
      if (entries?.length) continue;
    }
    if (await exists(target)) {
      if (dryRun) {
        removed.push(artifact.path);
        continue;
      }
      await fs.rm(target, { recursive: artifact.kind === "directory", force: true });
      removed.push(artifact.path);
    }
  }
  if (dryRun) return { status: "dry-run", removed };
  await fs.rm(receiptPath, { force: true });
  return { status: "rolled-back", removed };
}

export function rollbackSetup(repoRoot, options = {}) {
  return withSetupLock(repoRoot, () => rollbackSetupUnlocked(repoRoot, options));
}

export async function pruneRuntimeLogs(runtimeRoot, options = {}) {
  const maxBytes = options.maxBytes ?? MAX_RUNTIME_LOG_BYTES;
  const maxFiles = options.maxFiles ?? MAX_RUNTIME_LOG_FILES;
  const logs = [];
  async function collect(current) {
    const entries = await fs.readdir(current, { withFileTypes: true }).catch((error) => {
      if (error?.code === "ENOENT") return;
      throw error;
    });
    for (const entry of entries ?? []) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) await collect(target);
      else if (entry.isFile() && /\.(log|jsonl)$/.test(entry.name)) {
        const stat = await fs.stat(target);
        logs.push({ target, size: stat.size, mtimeMs: stat.mtimeMs });
      }
    }
  }
  await collect(runtimeRoot);
  logs.sort((a, b) => b.mtimeMs - a.mtimeMs);
  let total = 0;
  let retained = 0;
  for (let index = 0; index < logs.length; index += 1) {
    const log = logs[index];
    if (index >= maxFiles || total + log.size > maxBytes) {
      await fs.rm(log.target, { force: true });
      continue;
    }
    total += log.size;
    retained += 1;
  }
  return { retained, bytes: total };
}

export async function compactRuntimeState(repoRoot, options = {}) {
  const root = path.resolve(repoRoot);
  const maxAgeMs = options.maxAgeMs ?? 30 * 24 * 60 * 60 * 1000;
  const maxBytes = options.maxBytes ?? MAX_RUNTIME_LOG_BYTES;
  const maxFiles = options.maxFiles ?? MAX_RUNTIME_LOG_FILES;
  const archivePath = path.join(root, ".ma", "archive", "runtime-summary.jsonl");
  const roots = [
    path.join(root, ".ma", "runtime"),
    path.join(root, ".ma", "hooks", "receipts"),
    path.join(root, ".ma", "learning"),
    path.join(root, ".ma", "state", "recovery-receipts"),
  ];
  const entries = [];
  async function collect(current) {
    const children = await fs.readdir(current, { withFileTypes: true }).catch(() => []);
    for (const child of children) {
      const target = path.join(current, child.name);
      if (child.isDirectory()) await collect(target);
      else if (child.isFile() && /\.(log|jsonl|json)$/.test(child.name)) {
        const stat = await fs.stat(target);
        entries.push({ target, size: stat.size, mtimeMs: stat.mtimeMs });
      }
    }
  }
  await Promise.all(roots.map(collect));
  entries.sort((left, right) => right.mtimeMs - left.mtimeMs);
  const cutoff = Date.now() - maxAgeMs;
  const archive = [];
  let activeBytes = 0;
  let activeFiles = 0;
  for (const entry of entries) {
    const stale = entry.mtimeMs < cutoff;
    const overBudget = activeFiles >= maxFiles || activeBytes + entry.size > maxBytes;
    if (!stale && !overBudget) {
      activeBytes += entry.size;
      activeFiles += 1;
      continue;
    }
    archive.push({
      path: path.relative(root, entry.target),
      size: entry.size,
      modifiedAt: new Date(entry.mtimeMs).toISOString(),
      reason: stale ? "retention" : "budget",
    });
    await fs.rm(entry.target, { force: true });
  }
  if (archive.length) {
    await fs.mkdir(path.dirname(archivePath), { recursive: true });
    await fs.appendFile(
      archivePath,
      archive.map((entry) => `${JSON.stringify(entry)}\n`).join(""),
      { mode: 0o600 },
    );
  }
  return {
    retained: activeFiles,
    archived: archive.length,
    bytes: activeBytes,
    archivePath: archive.length ? path.relative(root, archivePath) : null,
  };
}

export const SETUP_RECEIPT_PATH = RECEIPT_RELATIVE_PATH;
