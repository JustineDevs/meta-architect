import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { writeJsonAtomically } from "./setup-lifecycle.js";

export const RUNTIME_STATE_MAX_BYTES = 50 * 1024 * 1024;
const localRuntimeLocks = new Map();

export async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

export async function writeJson(filePath, value) {
  await withRuntimeStateLock(filePath, () => writeJsonAtomically(filePath, value), { wait: true });
}

export async function writeTextAtomically(filePath, content) {
  await withRuntimeStateLock(filePath, () => writeTextAtomicallyUnlocked(filePath, content), {
    wait: true,
  });
}

async function writeTextAtomicallyUnlocked(filePath, content) {
  const temporary = `${filePath}.tmp-${randomUUID()}`;
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(temporary, content);
    await fs.rename(temporary, filePath);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

function runtimeStateRoot(filePath) {
  const absolute = path.resolve(filePath);
  const parts = absolute.split(path.sep);
  const maIndex = parts.lastIndexOf(".ma");
  if (maIndex < 0) return null;
  return path.join(path.sep, ...parts.slice(0, maIndex + 1));
}

function runtimeStateLockName(filePath, root) {
  const relative = path.relative(root, path.resolve(filePath));
  const subsystem = relative.split(path.sep)[0] || "root";
  return `.runtime-${subsystem.replace(/[^a-zA-Z0-9_.-]/g, "_")}.lock`;
}

async function writeRecoveryReceipt(root, reason, details) {
  const receiptPath = path.join(
    root,
    "state",
    "recovery-receipts",
    `runtime-${Date.now()}-${randomUUID()}.json`,
  );
  await writeJsonAtomically(receiptPath, {
    schemaVersion: "0.1.0",
    record_type: "runtime_recovery_receipt",
    generatedAt: new Date().toISOString(),
    reason,
    ...details,
  });
}

export async function withRuntimeStateLock(filePath, action, options = {}) {
  const root = runtimeStateRoot(filePath);
  if (!root) return action();
  const lockPath = path.join(root, "state", runtimeStateLockName(filePath, root));
  if (localRuntimeLocks.has(lockPath) && !options.wait) {
    throw new Error(`Meta-Architect runtime state is busy: ${path.relative(root, filePath)}`);
  }
  const previous = localRuntimeLocks.get(lockPath) ?? Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  localRuntimeLocks.set(lockPath, current);
  await previous;
  try {
    return await withExternalRuntimeStateLock(lockPath, filePath, root, action, options);
  } finally {
    release();
    if (localRuntimeLocks.get(lockPath) === current) localRuntimeLocks.delete(lockPath);
  }
}

async function withExternalRuntimeStateLock(lockPath, filePath, root, action, options) {
  const staleMs = options.staleMs ?? 60 * 60 * 1000;
  await fs.mkdir(path.dirname(lockPath), { recursive: true });
  let recovered = false;
  for (;;) {
    try {
      await fs.mkdir(lockPath);
      await fs.writeFile(
        path.join(lockPath, "owner.json"),
        `${JSON.stringify({ pid: process.pid, createdAt: Date.now(), filePath: path.resolve(filePath) })}\n`,
        { mode: 0o600 },
      );
      break;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const ownerPath = path.join(lockPath, "owner.json");
      const ownerText = await fs.readFile(ownerPath, "utf8").catch(() => null);
      const stat = await fs.stat(lockPath).catch(() => null);
      let owner;
      try {
        owner = ownerText ? JSON.parse(ownerText) : null;
      } catch {
        throw new Error(
          "Meta-Architect runtime lock is corrupt; remove it only after confirming no writer is running",
        );
      }
      const alive =
        Number.isInteger(owner?.pid) &&
        (() => {
          try {
            process.kill(owner.pid, 0);
            return true;
          } catch {
            return false;
          }
        })();
      const stale = owner ? !alive : Boolean(stat && Date.now() - stat.mtimeMs > staleMs);
      if (!stale) {
        if (!options.wait)
          throw new Error(`Meta-Architect runtime state is busy: ${path.relative(root, filePath)}`);
        if (stat && Date.now() - stat.mtimeMs < staleMs) {
          await new Promise((resolve) => setTimeout(resolve, 5));
          continue;
        }
        throw new Error(
          `Meta-Architect runtime state lock timed out: ${path.relative(root, filePath)}`,
        );
      }
      await fs.rm(lockPath, { recursive: true, force: true });
      recovered = true;
    }
  }
  try {
    if (recovered)
      await writeRecoveryReceipt(root, "stale-runtime-lock", {
        filePath: path.relative(root, filePath),
      });
    return await action();
  } finally {
    await fs.rm(lockPath, { recursive: true, force: true });
  }
}

export async function inspectRuntimeStateHealth(root) {
  const stateRoot = path.join(path.resolve(root), ".ma");
  const findings = [];
  let totalBytes = 0;
  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.endsWith(".lock"))
          findings.push({ type: "lock", path: path.relative(root, target) });
        else await walk(target);
        continue;
      }
      totalBytes += (await fs.stat(target).catch(() => ({ size: 0 }))).size;
      if (entry.name.includes(".tmp-")) {
        findings.push({ type: "temporary", path: path.relative(root, target) });
        continue;
      }
      if (entry.name.endsWith(".json")) {
        try {
          JSON.parse(await fs.readFile(target, "utf8"));
        } catch {
          findings.push({ type: "corrupt-json", path: path.relative(root, target) });
        }
      }
    }
  }
  await walk(stateRoot);
  if (totalBytes > RUNTIME_STATE_MAX_BYTES) {
    findings.push({ type: "oversized", path: path.relative(root, stateRoot), bytes: totalBytes });
  }
  return findings;
}

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function writeFileIfMissing(filePath, content) {
  try {
    await fs.access(filePath);
  } catch {
    await writeTextAtomically(filePath, content);
  }
}
