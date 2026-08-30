import { randomUUID } from "node:crypto";
import {
  chmodSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { safeSpawn } from "./process-utils.js";

const TEST_ROOT = path.join(os.tmpdir(), "ma-tests");
const RETENTION_ROOT = path.join(TEST_ROOT, "retained");
const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  ".next",
  ".ma",
  ".codex",
  ".omx",
  ".active",
  ".internal",
  ".npm-cache",
  ".turbo",
  ".vercel",
  "coverage",
]);
const generatedRoots = new Set();
let budgetQueue = Promise.resolve();
let exitHookInstalled = false;

function safeTestName(value) {
  const name = String(value || "fixture")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return name.slice(0, 80) || "fixture";
}

function ensureExitHook() {
  if (exitHookInstalled) return;
  exitHookInstalled = true;
  process.once("exit", () => {
    for (const root of generatedRoots) {
      try {
        rmSync(root, { recursive: true, force: true });
      } catch {
        // Best-effort cleanup during process shutdown.
      }
    }
  });
}

export function createTestNamespace(testName) {
  assertRealTestRootSync(TEST_ROOT);
  mkdirSync(TEST_ROOT, { recursive: true, mode: 0o700 });
  try {
    chmodSync(TEST_ROOT, 0o700);
  } catch {
    // The OS may reject chmod on an unusual temporary filesystem.
  }
  mkdirSync(RETENTION_ROOT, { recursive: true, mode: 0o700 });
  const suffix = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
  const root = mkdtempSync(path.join(TEST_ROOT, `${safeTestName(testName)}-${suffix}-`));
  writeFileSync(path.join(root, ".active"), `${process.pid}\n`, { mode: 0o600 });
  generatedRoots.add(root);
  ensureExitHook();
  return root;
}

export async function removeTestNamespace(root) {
  const resolved = path.resolve(root);
  assertTestNamespace(resolved, "Fixture root");
  const metadata = await fs.lstat(resolved).catch(() => null);
  if (metadata?.isSymbolicLink()) throw new Error(`Refusing symlinked fixture path: ${resolved}`);
  generatedRoots.delete(root);
  await fs.rm(resolved, { recursive: true, force: true });
}

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertTestNamespace(root, label) {
  if (root === TEST_ROOT || !isWithin(TEST_ROOT, root) || isWithin(RETENTION_ROOT, root)) {
    throw new Error(`${label} must be inside ${TEST_ROOT}`);
  }
}

function assertRealTestRootSync(root) {
  const metadata = lstatSync(root, { throwIfNoEntry: false });
  if (metadata?.isSymbolicLink()) throw new Error(`Refusing symlinked test root: ${root}`);
  const retention = lstatSync(RETENTION_ROOT, { throwIfNoEntry: false });
  if (retention?.isSymbolicLink())
    throw new Error(`Refusing symlinked retention root: ${RETENTION_ROOT}`);
}

async function assertNoSymlinkComponents(root, candidate) {
  let current = root;
  const relative = path.relative(root, candidate);
  for (const part of relative ? relative.split(path.sep) : []) {
    current = path.join(current, part);
    const metadata = await fs.lstat(current).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (metadata?.isSymbolicLink()) {
      throw new Error(`Refusing symlinked fixture path: ${candidate}`);
    }
    if (!metadata) break;
  }
}

function assertNoSymlinkComponentsSync(root, candidate) {
  let current = root;
  const relative = path.relative(root, candidate);
  for (const part of relative ? relative.split(path.sep) : []) {
    current = path.join(current, part);
    const metadata = lstatSync(current, { throwIfNoEntry: false });
    if (metadata?.isSymbolicLink()) {
      throw new Error(`Refusing symlinked fixture path: ${candidate}`);
    }
    if (!metadata) break;
  }
}

async function assertRealFixtureRoot(root) {
  const metadata = await fs.lstat(root).catch(() => null);
  if (metadata?.isSymbolicLink()) throw new Error(`Refusing symlinked fixture root: ${root}`);
}

export async function pruneTestFixture(fixtureRoot) {
  const root = path.resolve(fixtureRoot);
  assertTestNamespace(root, "Fixture root");
  await assertRealFixtureRoot(root);
  const generatedPaths = [
    ".ma/runtime",
    ".ma/context",
    ".ma/learning",
    ".ma/obsidian",
    ".ma/redaction-vault",
    ".codex/agents",
    ".codex/prompts",
    ".codex/skills",
    "node_modules",
    "dist",
    ".next",
    ".vercel",
    ".turbo",
  ];

  await Promise.all(
    generatedPaths.map(async (relative) => {
      const target = path.resolve(root, relative);
      if (isWithin(root, target)) {
        await assertNoSymlinkComponents(root, target);
        await fs.rm(target, { recursive: true, force: true });
      }
    }),
  );

  const receiptRoots = [path.join(root, "receipts"), path.join(root, ".ma", "hooks", "receipts")];
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const receiptsRoot of receiptRoots) {
    let entries = [];
    try {
      entries = await fs.readdir(receiptsRoot, { withFileTypes: true });
    } catch {
      continue;
    }
    await Promise.all(
      entries.map(async (entry) => {
        if (!entry.isFile() || !entry.name.endsWith(".json")) return;
        const receipt = path.join(receiptsRoot, entry.name);
        await assertNoSymlinkComponents(root, receipt);
        const metadata = await fs.stat(receipt).catch(() => null);
        if (metadata && metadata.mtimeMs < cutoff) await fs.rm(receipt, { force: true });
      }),
    );
  }
}

async function copyTree(sourceRoot, targetRoot, { strategy = "copy" } = {}) {
  await fs.mkdir(targetRoot, { recursive: true });
  const entries = await fs.readdir(sourceRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    const source = path.join(sourceRoot, entry.name);
    const target = path.join(targetRoot, entry.name);
    const metadata = await fs.lstat(source).catch(() => null);
    if (!metadata || metadata.isSymbolicLink()) continue;
    if (metadata.isDirectory()) {
      await copyTree(source, target, { strategy });
      continue;
    }
    if (!metadata.isFile()) continue;
    await fs.mkdir(path.dirname(target), { recursive: true });
    if (strategy === "hardlink") {
      await fs.link(source, target);
      continue;
    }
    if (strategy === "reflink") {
      await fs.copyFile(source, target, constants.COPYFILE_FICLONE_FORCE);
    } else {
      await fs.copyFile(source, target);
    }
  }
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = safeSpawn(command, args, { stdio: "ignore" });
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)),
    );
  });
}

function isCopyCapabilityError(error) {
  return ["EOPNOTSUPP", "ENOTSUP", "EXDEV", "EINVAL"].includes(error?.code);
}

async function copyProjectFixtureInternal(sourceRoot, targetRoot, options = {}) {
  const source = path.resolve(sourceRoot);
  const target = path.resolve(targetRoot);
  assertTestNamespace(target, "Fixture target");
  await assertNoSymlinkComponents(TEST_ROOT, target);
  if (source === target || isWithin(source, target))
    throw new Error("Fixture target must be outside the source tree");
  await fs.mkdir(target, { recursive: true });
  const existingEntries = (await fs.readdir(target)).filter((entry) => entry !== ".active");
  if (existingEntries.length > 0) {
    throw new Error("Fixture target must be empty");
  }

  if (options.useReflink !== false) {
    try {
      await copyTree(source, target, { strategy: "reflink" });
      return await enforceFixtureBudget(target, "reflink");
    } catch (error) {
      if (!isCopyCapabilityError(error)) throw error;
      await fs.rm(target, { recursive: true, force: true });
      await fs.mkdir(target, { recursive: true });
    }
  }
  // ponytail: hardlinks are opt-in because writes would mutate the source; reflink/rsync preserve isolation.
  if (options.useHardlinks === true) {
    try {
      await copyTree(source, target, { strategy: "hardlink" });
      return await enforceFixtureBudget(target, "hardlink");
    } catch (error) {
      if (!isCopyCapabilityError(error)) throw error;
      await fs.rm(target, { recursive: true, force: true });
      await fs.mkdir(target, { recursive: true });
    }
  }
  if (options.useHardlinks === false) {
    await fs.rm(target, { recursive: true, force: true });
    await fs.mkdir(target, { recursive: true });
  }
  try {
    await runCommand("rsync", [
      "-a",
      "--delete",
      "--exclude=node_modules",
      "--exclude=dist",
      "--exclude=.next",
      "--exclude=.ma",
      "--exclude=.codex",
      "--exclude=.git",
      "--exclude=.omx",
      "--exclude=.internal",
      "--exclude=.npm-cache",
      "--exclude=.turbo",
      "--exclude=.vercel",
      "--exclude=coverage",
      "--exclude=.active",
      "--no-links",
      `${source}${path.sep}`,
      `${target}${path.sep}`,
    ]);
    return await enforceFixtureBudget(target, "rsync");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    await fs.rm(target, { recursive: true, force: true });
    await fs.mkdir(target, { recursive: true });
    await copyTree(source, target, { strategy: "copy" });
    return await enforceFixtureBudget(target, "copy");
  }
}

export async function copyProjectFixture(sourceRoot, targetRoot, options = {}) {
  const source = path.resolve(sourceRoot);
  const target = path.resolve(targetRoot);
  assertTestNamespace(target, "Fixture target");
  try {
    return await copyProjectFixtureInternal(sourceRoot, target, options);
  } catch (error) {
    if (target !== source) {
      for (const entry of await fs.readdir(target).catch(() => [])) {
        if (entry !== ".active") {
          await fs.rm(path.join(target, entry), { recursive: true, force: true });
        }
      }
    }
    throw error;
  }
}

async function enforceFixtureBudget(root, strategy) {
  const check = budgetQueue.then(async () => {
    const bytes = await getTestDiskUsage(root);
    if (bytes > TEST_FIXTURE_LIMITS.hardFixtureBytes) {
      await fs.rm(root, { recursive: true, force: true });
      throw new Error(`Fixture exceeds hard disk budget: ${bytes} bytes`);
    }
    // ponytail: periodic aggregate scan avoids O(fixtures^2) setup while retaining a hard cap.
    if (generatedRoots.size % 16 === 0) {
      const total = await getTestDiskUsage(TEST_ROOT);
      if (total > TEST_FIXTURE_LIMITS.maxTotalBytes) {
        await fs.rm(root, { recursive: true, force: true });
        throw new Error(`Test fixture root exceeds disk budget: ${total} bytes`);
      }
    }
    return { strategy, bytes };
  });
  budgetQueue = check.catch(() => {});
  return check;
}

async function runArchive(args) {
  return new Promise((resolve, reject) => {
    const child = safeSpawn("tar", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0 ? resolve() : reject(new Error(stderr || `tar exited with ${code}`)),
    );
  });
}

async function commandAvailable(command) {
  try {
    await runCommand(command, ["--version"]);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

export async function compressMaState(fixtureRoot) {
  const root = path.resolve(fixtureRoot);
  assertTestNamespace(root, "Fixture root");
  await assertRealFixtureRoot(root);
  const maDir = path.join(root, ".ma");
  if (!existsSync(maDir)) return null;
  await assertNoSymlinkComponents(root, maDir);
  const archiveBase = `${path.basename(root)}-${Date.now().toString(36)}`;
  const zstdPath = path.join(RETENTION_ROOT, `${archiveBase}.tar.zst`);
  if (await commandAvailable("zstd")) {
    await runArchive(["--use-compress-program=zstd", "-cf", zstdPath, "-C", maDir, "."]);
    await fs.rm(maDir, { recursive: true, force: true });
    return zstdPath;
  }
  const gzipPath = path.join(RETENTION_ROOT, `${archiveBase}.tar.gz`);
  await runArchive(["-czf", gzipPath, "-C", maDir, "."]);
  await fs.rm(maDir, { recursive: true, force: true });
  return gzipPath;
}

export function createMinimalFixture(fixtureRoot, fixture) {
  const root = path.resolve(fixtureRoot);
  assertTestNamespace(root, "Fixture root");
  const created = [];
  return (async () => {
    const files = Object.entries(fixture.files || {});
    const targets = [];
    for (const [relative] of files) {
      const target = path.resolve(root, relative);
      if (!isWithin(root, target)) throw new Error(`Fixture path escapes root: ${relative}`);
      await assertRealFixtureRoot(root);
      await assertNoSymlinkComponents(root, target);
      targets.push(target);
    }
    for (let index = 0; index < files.length; index += 1) {
      const [, content] = files[index];
      const target = targets[index];
      if (!existsSync(target)) created.push(target);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content);
    }
    if (fixture.maContext) {
      const contextRoot = path.join(root, ".ma", "context");
      await fs.mkdir(contextRoot, { recursive: true });
      const contextPath = path.join(contextRoot, "project-index.json");
      if (!existsSync(contextPath)) created.push(contextPath);
      await fs.writeFile(
        contextPath,
        `${JSON.stringify(
          {
            schemaVersion: "1.0",
            languages: ["typescript"],
            frameworks: [],
            commands: { test: "echo test" },
            generatedDirectories: ["node_modules", "dist"],
            ...fixture.maContext,
          },
          null,
          2,
        )}\n`,
      );
    }
    return enforceFixtureBudget(root, "minimal");
  })().catch(async (error) => {
    await Promise.all(created.map((file) => fs.rm(file, { force: true })));
    throw error;
  });
}

export function runTestWithStreaming(command, args, options) {
  const {
    logPath,
    summaryPath,
    timeoutMs = 120_000,
    maxLogBytes = TEST_FIXTURE_LIMITS.hardFixtureBytes,
  } = options;
  const logFile = path.resolve(logPath);
  const summaryFile = path.resolve(summaryPath);
  assertTestNamespace(path.dirname(logFile), "Log path");
  assertTestNamespace(path.dirname(summaryFile), "Summary path");
  assertNoSymlinkComponentsSync(TEST_ROOT, logFile);
  assertNoSymlinkComponentsSync(TEST_ROOT, summaryFile);
  return new Promise((resolve, reject) => {
    const child = safeSpawn(command, args, { stdio: ["inherit", "pipe", "pipe"] });
    const log = fs.open(logFile, "w");
    const summary = fs.open(summaryFile, "w");
    let summaryBytes = 0;
    let logBytes = 0;
    let writeError = null;
    let settled = false;
    const pendingWrites = new Set();
    let writeQueue = Promise.resolve();
    let forceTimer;
    const terminate = () => {
      if (child.exitCode !== null) return;
      child.kill("SIGTERM");
      forceTimer = setTimeout(() => child.kill("SIGKILL"), 1_000);
    };
    const writeLine = async (line, includeInSummary) => {
      const [logHandle, summaryHandle] = await Promise.all([log, summary]);
      const value = `${line}\n`;
      const valueBytes = Buffer.byteLength(value);
      if (logBytes + valueBytes > maxLogBytes) {
        throw new Error(`Test log exceeds disk budget: ${maxLogBytes} bytes`);
      }
      await logHandle.write(value);
      logBytes += valueBytes;
      if (includeInSummary && summaryBytes < 1024 * 1024) {
        const remaining = 1024 * 1024 - summaryBytes;
        const bounded = Buffer.from(value).subarray(0, remaining);
        await summaryHandle.write(bounded);
        summaryBytes += bounded.length;
      }
    };
    const queueWrite = (line, includeInSummary) => {
      const pending = writeQueue.then(() => writeLine(line, includeInSummary));
      writeQueue = pending.catch(() => {});
      pendingWrites.add(pending);
      void pending.then(
        () => pendingWrites.delete(pending),
        (error) => {
          writeError ||= error;
          pendingWrites.delete(pending);
          terminate();
        },
      );
    };
    const onData = (chunk, forceSummary) => {
      for (const line of chunk.toString().split(/\r?\n/)) {
        if (line) queueWrite(line, forceSummary || /ERROR|FAIL|receipt/i.test(line));
      }
    };
    child.stdout.on("data", (chunk) => onData(chunk, false));
    child.stderr.on("data", (chunk) => onData(chunk, true));
    const timer = setTimeout(terminate, timeoutMs);
    const finish = async (code, signal, error = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(forceTimer);
      try {
        await Promise.all([...pendingWrites]);
        const [logHandle, summaryHandle] = await Promise.all([log, summary]);
        await Promise.all([logHandle.close(), summaryHandle.close()]);
        if (error || writeError) reject(error || writeError);
        else resolve({ code: code ?? 1, signal });
      } catch (closeError) {
        reject(closeError);
      }
    };
    child.once("error", (error) => finish(1, null, error));
    child.once("close", async (code, signal) => {
      await finish(code, signal);
    });
  });
}

export async function getTestDiskUsage(root = TEST_ROOT) {
  let total = 0;
  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(target);
      else if (entry.isFile()) {
        const stat = await fs
          .stat(target)
          .catch((error) => (error?.code === "ENOENT" ? null : Promise.reject(error)));
        if (stat) total += stat.size;
      }
    }
  }
  await walk(root);
  return total;
}

export const TEST_FIXTURE_ROOT = TEST_ROOT;
export const TEST_FIXTURE_LIMITS = Object.freeze({
  maxFixtureBytes: 20 * 1024 * 1024,
  hardFixtureBytes: 50 * 1024 * 1024,
  maxTotalBytes: 1024 * 1024 * 1024,
});
