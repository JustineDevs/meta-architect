import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { safeExecFile } from "../src/process-utils.js";
import { enqueueAutonomousTasks, runAutonomousTasks } from "../src/runtime/autonomous-tasks.js";
import { executeWorkspaceTask } from "../src/runtime/task-executor.js";
import { createTestNamespace } from "../src/test-fixtures.js";

const execFile = promisify(safeExecFile);

async function createRepo(t, name) {
  const root = createTestNamespace(name);
  await execFile("git", ["init", "-q", root]);
  await execFile("git", ["-C", root, "config", "user.email", "test@example.invalid"]);
  await execFile("git", ["-C", root, "config", "user.name", "Test"]);
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.writeFile(path.join(root, "src", "index.txt"), "before\n");
  await execFile("git", ["-C", root, "add", "."]);
  await execFile("git", ["-C", root, "commit", "-qm", "fixture"]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

function command(script) {
  return { file: process.execPath, args: ["-e", script], timeoutMs: 10_000 };
}

test("workspace executor mutates only allowed files and verifies the result", async (t) => {
  const root = await createRepo(t, "task-executor-success");
  const result = await executeWorkspaceTask({
    id: "write-source",
    attempts: 1,
    execution: {
      workspace_root: root,
      mutation_mode: "source_write",
      allowed_paths: ["src"],
      command: command("require('fs').writeFileSync('src/index.txt', 'after\\n')"),
      verification: [
        command(
          "if (require('fs').readFileSync('src/index.txt', 'utf8') !== 'after\\n') process.exit(1)",
        ),
      ],
    },
  });
  assert.equal(result.status, "completed");
  assert.deepEqual(result.receipt.changedFiles, ["src/index.txt"]);
  assert.equal(result.receipt.disallowedFiles.length, 0);
  assert.match(result.evidence[0], /workspace execution receipt/);
});

test("workspace executor fails closed for changes outside the allowed paths", async (t) => {
  const root = await createRepo(t, "task-executor-boundary");
  const result = await executeWorkspaceTask({
    id: "escape-source",
    attempts: 1,
    execution: {
      workspace_root: root,
      mutation_mode: "source_write",
      allowed_paths: ["src"],
      command: command("require('fs').writeFileSync('outside.txt', 'blocked\\n')"),
      verification: [],
    },
  });
  assert.equal(result.status, "failed");
  assert.deepEqual(result.receipt.disallowedFiles, ["outside.txt"]);
});

test("workspace executor detects mutations to ignored files", async (t) => {
  const root = await createRepo(t, "task-executor-ignored-boundary");
  await fs.writeFile(path.join(root, ".gitignore"), "outside.log\n");
  await execFile("git", ["-C", root, "add", ".gitignore"]);
  await execFile("git", ["-C", root, "commit", "-qm", "ignore fixture"]);
  const result = await executeWorkspaceTask({
    id: "ignored-escape-source",
    attempts: 1,
    execution: {
      workspace_root: root,
      mutation_mode: "source_write",
      allowed_paths: ["src"],
      command: command("require('fs').writeFileSync('outside.log', 'blocked\\n')"),
      verification: [],
    },
  });
  assert.equal(result.status, "failed");
  assert.deepEqual(result.receipt.disallowedFiles, ["outside.log"]);
});

test("workspace executor detects mutations to files that were already dirty", async (t) => {
  const root = await createRepo(t, "task-executor-dirty-boundary");
  await fs.writeFile(path.join(root, "outside.txt"), "already dirty\n");
  const result = await executeWorkspaceTask({
    id: "dirty-escape-source",
    attempts: 1,
    execution: {
      workspace_root: root,
      mutation_mode: "source_write",
      allowed_paths: ["src"],
      command: command("require('fs').writeFileSync('outside.txt', 'changed\\n')"),
      verification: [],
    },
  });
  assert.equal(result.status, "failed");
  assert.deepEqual(result.receipt.disallowedFiles, ["outside.txt"]);
});

test("workspace executor rejects symlink paths created during execution", async (t) => {
  const root = await createRepo(t, "task-executor-symlink-boundary");
  const result = await executeWorkspaceTask({
    id: "symlink-escape",
    attempts: 1,
    execution: {
      workspace_root: root,
      mutation_mode: "source_write",
      allowed_paths: ["src"],
      command: command(
        "require('fs').symlinkSync('../outside.txt', 'src/escape.txt'); require('fs').writeFileSync('outside.txt', 'escaped\\n')",
      ),
      verification: [],
    },
  });
  assert.equal(result.status, "failed");
  assert.equal(result.receipt.disallowedFiles.includes("src/escape.txt"), true);
});

test("read-only workspace executor rejects source mutations", async (t) => {
  const root = await createRepo(t, "task-executor-read-only");
  const result = await executeWorkspaceTask({
    id: "read-only",
    attempts: 1,
    execution: {
      workspace_root: root,
      mutation_mode: "read_only",
      allowed_paths: [],
      command: command("require('fs').writeFileSync('src/index.txt', 'unexpected\\n')"),
      verification: [],
    },
  });
  assert.equal(result.status, "failed");
  assert.deepEqual(result.receipt.disallowedFiles, ["src/index.txt"]);
});

test("autonomous queue runs a workspace task end to end and records evidence", async (t) => {
  const root = await createRepo(t, "task-executor-queue");
  const previousRoot = process.env.MA_ROOT;
  process.env.MA_ROOT = root;
  t.after(() => {
    if (previousRoot === undefined) delete process.env.MA_ROOT;
    else process.env.MA_ROOT = previousRoot;
  });
  await enqueueAutonomousTasks({
    id: "queue-write",
    goal: "Apply the requested source change",
    execution: {
      workspace_root: root,
      mutation_mode: "source_write",
      allowed_paths: ["src"],
      command: command("require('fs').writeFileSync('src/index.txt', 'queued\\n')"),
      verification: [
        command(
          "if (require('fs').readFileSync('src/index.txt', 'utf8') !== 'queued\\n') process.exit(1)",
        ),
      ],
    },
  });
  const result = await runAutonomousTasks({ execute: executeWorkspaceTask });
  assert.equal(result.summary.completed, 1);
  assert.equal(result.tasks[0].status, "completed");
  assert.equal(
    result.tasks[0].evidence.some((entry) => entry.includes("workspace execution receipt")),
    true,
  );
  assert.equal(await fs.readFile(path.join(root, "src", "index.txt"), "utf8"), "queued\n");
});

test("default autonomous runner routes a workspace task through Maestro build", async (t) => {
  const root = await createRepo(t, "task-executor-maestro-default");
  const previousRoot = process.env.MA_ROOT;
  const previousLive = process.env.MA_DISABLE_LIVE_MCP;
  process.env.MA_ROOT = root;
  process.env.MA_DISABLE_LIVE_MCP = "1";
  t.after(() => {
    if (previousRoot === undefined) delete process.env.MA_ROOT;
    else process.env.MA_ROOT = previousRoot;
    if (previousLive === undefined) delete process.env.MA_DISABLE_LIVE_MCP;
    else process.env.MA_DISABLE_LIVE_MCP = previousLive;
  });
  const { runInit } = await import("../src/skills.js");
  await runInit();
  const ready = {
    idea_status: "CLEAR",
    architecture_status: "APPROVED",
    evidence_status: "VERIFIED",
    logic_status: "GREEN",
    security_status: "GREEN",
    experience_status: "GREEN",
    build_status: "READY",
  };
  for (const file of ["release.json", "decisions.json"]) {
    const target = path.join(root, ".ma", file);
    const current = JSON.parse(await fs.readFile(target, "utf8"));
    await fs.writeFile(target, `${JSON.stringify({ ...current, ...ready }, null, 2)}\n`);
  }
  await enqueueAutonomousTasks({
    id: "default-maestro-build",
    goal: "Execute the declared workspace change through Maestro",
    execution: {
      workspace_root: root,
      mutation_mode: "source_write",
      allowed_paths: ["src"],
      command: command("require('fs').appendFileSync('src/index.txt', 'maestro\\n')"),
      verification: [
        command(
          "if (require('fs').readFileSync('src/index.txt', 'utf8') !== 'before\\nmaestro\\n') process.exit(1)",
        ),
      ],
    },
  });
  const result = await runAutonomousTasks();
  assert.equal(result.summary.completed, 1);
  assert.equal(result.tasks[0].status, "completed");
  assert.equal(await fs.readFile(path.join(root, "src", "index.txt"), "utf8"), "before\nmaestro\n");
});
