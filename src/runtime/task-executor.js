import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { safeSpawn } from "../process-utils.js";
import { writeJsonAtomically } from "../setup-lifecycle.js";

const MAX_OUTPUT_BYTES = 1_000_000;
const CONTROL_PATH = ".ma/tasks/execution-receipts/";
const JOURNAL_PATH = ".ma/tasks/execution-journal/";
const IGNORED_SCAN_EXCLUDES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".turbo",
  "coverage",
]);

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertWorkspaceRoot(root) {
  if (!path.isAbsolute(root)) throw new Error("Task workspace_root must be absolute");
  if (path.basename(root) === ".") throw new Error("Task workspace_root is invalid");
}

function assertTaskId(taskId) {
  if (typeof taskId !== "string" || !/^[a-zA-Z0-9._-]+$/.test(taskId)) {
    throw new Error("Task id must contain only letters, numbers, dots, underscores, or hyphens");
  }
}

async function assertRealWorkspace(root) {
  assertWorkspaceRoot(root);
  const stat = await fs.lstat(root);
  if (!stat.isDirectory() || stat.isSymbolicLink())
    throw new Error("Task workspace_root must be a real directory");
}

async function assertNoSymlinkComponents(root, candidate) {
  let current = root;
  const relative = path.relative(root, candidate);
  for (const component of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    const stat = await fs.lstat(current).catch((error) => {
      if (error?.code === "ENOENT") return null;
      throw error;
    });
    if (stat?.isSymbolicLink()) throw new Error(`Task path cannot traverse a symlink: ${relative}`);
  }
}

function resolveAllowedPaths(root, allowedPaths) {
  if (!Array.isArray(allowedPaths) || allowedPaths.length === 0)
    throw new Error("Mutating tasks require at least one allowed path");
  return allowedPaths.map((relative) => {
    const resolved = path.resolve(root, relative);
    if (!isWithin(root, resolved))
      throw new Error(`Allowed task path escapes workspace: ${relative}`);
    return resolved;
  });
}

async function runProcess(command, cwd, timeoutMs) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const child = safeSpawn(command.file, command.args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const append = (target, chunk) => {
      const value = chunk.toString();
      return (target + value).slice(-MAX_OUTPUT_BYTES);
    };
    child.stdout?.on("data", (chunk) => {
      stdout = append(stdout, chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr = append(stderr, chunk);
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 2_000).unref();
    }, timeoutMs);
    child.once("error", reject);
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, signal, stdout, stderr, timedOut });
    });
  });
}

async function gitOutput(root, args) {
  const result = await runProcess({ file: "git", args, timeoutMs: 30_000 }, root, 30_000);
  if (result.code !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim()}`);
  return result.stdout;
}

async function snapshotWorkspace(root) {
  const porcelain = await gitOutput(root, ["status", "--porcelain=v1", "-z"]);
  const diff = await gitOutput(root, ["diff", "--binary"]);
  const trackedFiles = await gitOutput(root, ["ls-files", "-co", "--exclude-standard", "-z"]);
  const ignoredFiles = await gitOutput(root, [
    "ls-files",
    "--others",
    "--ignored",
    "--exclude-standard",
    "-z",
  ]);
  const files = {};
  const candidates = [
    ...trackedFiles.split("\0").filter(Boolean),
    ...ignoredFiles
      .split("\0")
      .filter(Boolean)
      .filter((relative) => !relative.split("/").some((part) => IGNORED_SCAN_EXCLUDES.has(part))),
  ];
  for (const relative of candidates) {
    if (relative.startsWith(CONTROL_PATH) || relative.startsWith(JOURNAL_PATH)) continue;
    const absolute = path.resolve(root, relative);
    if (!isWithin(root, absolute)) continue;
    const stat = await fs.lstat(absolute).catch((error) => {
      if (error?.code === "ENOENT") return null;
      throw error;
    });
    if (!stat) {
      files[relative] = "missing";
    } else if (stat.isSymbolicLink()) {
      files[relative] = `symlink:${await fs.readlink(absolute)}`;
    } else if (stat.isFile()) {
      files[relative] = `file:${crypto
        .createHash("sha256")
        .update(await fs.readFile(absolute))
        .digest("hex")}`;
    } else {
      files[relative] = `special:${stat.mode}`;
    }
  }
  return { porcelain, diff, files };
}

function changedHash(snapshot) {
  return crypto
    .createHash("sha256")
    .update(snapshot.porcelain)
    .update("\0")
    .update(snapshot.diff)
    .update("\0")
    .update(JSON.stringify(snapshot.files, Object.keys(snapshot.files).sort()))
    .digest("hex");
}

function newChangedFiles(before, after) {
  const files = new Set([...Object.keys(before.files), ...Object.keys(after.files)]);
  return [...files]
    .filter((file) => before.files[file] !== after.files[file])
    .filter((file) => !file.startsWith(CONTROL_PATH) && !file.startsWith(JOURNAL_PATH))
    .sort();
}

function withinAllowed(root, file, allowedRoots) {
  const absolute = path.resolve(root, file);
  return allowedRoots.some((allowed) => isWithin(allowed, absolute));
}

async function writeReceipt(root, task, receipt) {
  const receiptPath = path.join(
    root,
    CONTROL_PATH,
    `${task.id}-${task.attempts}-${Date.now()}.json`,
  );
  await writeJsonAtomically(receiptPath, receipt);
  return path.relative(root, receiptPath);
}

function journalPath(root, task) {
  return path.join(root, JOURNAL_PATH, `${task.id}-${task.attempts}.json`);
}

async function writeExecutionJournal(root, task, execution, before) {
  const file = journalPath(root, task);
  await writeJsonAtomically(file, {
    schemaVersion: "1.0.0",
    recordType: "workspace_task_execution_journal",
    taskId: task.id,
    attempt: task.attempts,
    workspaceRoot: root,
    mutationMode: execution.mutation_mode,
    allowedPaths: execution.allowed_paths,
    before,
    createdAt: new Date().toISOString(),
  });
  return file;
}

async function clearExecutionJournal(root, task) {
  await fs.rm(journalPath(root, task), { force: true });
}

export async function recoverWorkspaceExecution(task) {
  assertTaskId(task?.id);
  const execution = task.execution ?? task.contract?.execution;
  if (!execution?.command) return null;
  const root = path.resolve(execution.workspace_root);
  const file = journalPath(root, task);
  const journal = await fs
    .readFile(file, "utf8")
    .then(JSON.parse)
    .catch((error) => {
      if (error?.code === "ENOENT") return null;
      throw error;
    });
  if (!journal) return null;
  const current = await snapshotWorkspace(root);
  if (changedHash(journal.before) === changedHash(current)) {
    await clearExecutionJournal(root, task);
    return null;
  }
  return {
    status: "blocked",
    reason: "Interrupted execution left unreconciled workspace changes; inspect before retrying",
    evidence: [`workspace execution journal: ${file}`],
  };
}

export async function executeWorkspaceTask(task) {
  assertTaskId(task?.id);
  const execution = task.execution ?? task.contract?.execution;
  if (!execution?.command) return { status: "blocked", reason: "Task has no executable command" };
  const root = path.resolve(execution.workspace_root);
  await assertRealWorkspace(root);
  const mutationMode = execution.mutation_mode ?? "read_only";
  const allowedRoots =
    mutationMode === "read_only" ? [] : resolveAllowedPaths(root, execution.allowed_paths);
  if (mutationMode !== "read_only") {
    await Promise.all(allowedRoots.map((allowed) => assertNoSymlinkComponents(root, allowed)));
  }

  const before = await snapshotWorkspace(root);
  await writeExecutionJournal(root, task, execution, before);
  const startedAt = new Date().toISOString();
  const commandResult = await runProcess(execution.command, root, execution.command.timeoutMs);
  const verification = [];
  if (commandResult.code === 0) {
    for (const command of execution.verification ?? []) {
      const result = await runProcess(command, root, command.timeoutMs);
      verification.push({ argv: [command.file, ...command.args], ...result });
      if (result.code !== 0) break;
    }
  }
  const after = await snapshotWorkspace(root);
  const changedFiles = newChangedFiles(before, after);
  const changedPathsAreSafe = await Promise.all(
    changedFiles.map(async (file) => {
      const absolute = path.resolve(root, file);
      try {
        await assertNoSymlinkComponents(root, absolute);
        return true;
      } catch {
        return false;
      }
    }),
  );
  const symlinkChangedFiles = changedFiles.filter((_, index) => !changedPathsAreSafe[index]);
  const disallowedFiles =
    mutationMode === "read_only"
      ? changedFiles
      : changedFiles.filter((file) => !withinAllowed(root, file, allowedRoots));
  disallowedFiles.push(...symlinkChangedFiles.filter((file) => !disallowedFiles.includes(file)));
  const verificationPassed = verification.every((result) => result.code === 0 && !result.timedOut);
  const passed =
    commandResult.code === 0 &&
    !commandResult.timedOut &&
    verificationPassed &&
    disallowedFiles.length === 0;
  const reason = commandResult.timedOut
    ? "Task command timed out"
    : disallowedFiles.length > 0
      ? `Task changed files outside allowed paths: ${disallowedFiles.join(", ")}`
      : !verificationPassed
        ? "Task verification command failed"
        : commandResult.code !== 0
          ? `Task command exited with code ${commandResult.code}`
          : null;
  const receipt = {
    schemaVersion: "1.0.0",
    recordType: "workspace_task_execution",
    taskId: task.id,
    attempt: task.attempts,
    workspaceRoot: root,
    mutationMode,
    allowedPaths: execution.allowed_paths,
    command: { argv: [execution.command.file, ...execution.command.args], ...commandResult },
    verification,
    changedFiles,
    disallowedFiles,
    beforeHash: changedHash(before),
    afterHash: changedHash(after),
    startedAt,
    completedAt: new Date().toISOString(),
    status: passed ? "completed" : "failed",
    reason,
  };
  const receiptPath = await writeReceipt(root, task, receipt);
  await clearExecutionJournal(root, task);
  return {
    status: passed ? "completed" : "failed",
    reason,
    evidence: [
      `workspace execution receipt: ${path.join(root, receiptPath)}`,
      `changed files: ${changedFiles.length}`,
      `verification commands: ${verification.length}`,
    ],
    receipt,
  };
}
