import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  cancelAutonomousTask,
  createTaskQueue,
  enqueueAutonomousTasks,
  parseTaskInput,
  runAutonomousTasks,
  validateTaskQueue,
} from "../src/runtime/autonomous-tasks.js";
import { createTestNamespace } from "../src/test-fixtures.js";

async function withRoot(t) {
  const root = createTestNamespace("autonomous-tasks");
  const previous = process.env.MA_ROOT;
  process.env.MA_ROOT = root;
  t.after(async () => {
    if (previous === undefined) delete process.env.MA_ROOT;
    else process.env.MA_ROOT = previous;
    await fs.rm(root, { recursive: true, force: true });
  });
}

test("accepts durable tasks and runs dependency order with retry", async (t) => {
  await withRoot(t);
  await enqueueAutonomousTasks([
    {
      id: "build",
      goal: "Build the project",
      priority: "high",
      dependencies: ["test"],
      vendor: "codex",
    },
    { id: "test", goal: "Run tests", labels: ["verification"] },
  ]);
  const calls = [];
  let attempts = 0;
  const result = await runAutonomousTasks({
    execute: async (task) => {
      calls.push(task.id);
      if (task.id === "test" && attempts++ === 0) return { status: "failed", reason: "transient" };
      return { status: "completed", evidence: [`verified:${task.id}`] };
    },
  });
  assert.deepEqual(calls, ["test", "test", "build"]);
  assert.equal(result.summary.completed, 2);
  assert.ok(result.tasks.every((task) => task.status === "completed"));
  assert.equal(result.tasks.find((task) => task.id === "build").invocation, "$maestro");
});

test("blocks unsafe work, supports cancellation, and resumes queued work", async (t) => {
  await withRoot(t);
  await enqueueAutonomousTasks([
    { id: "deploy", goal: "Deploy to production" },
    { id: "docs", goal: "Update documentation" },
  ]);
  await cancelAutonomousTask("docs");
  const result = await runAutonomousTasks({ execute: async () => ({ status: "completed" }) });
  assert.equal(result.tasks.find((task) => task.id === "deploy").status, "blocked");
  assert.equal(result.tasks.find((task) => task.id === "docs").status, "cancelled");
});

test("terminalizes expired tasks and dependents of failed tasks", async (t) => {
  await withRoot(t);
  await enqueueAutonomousTasks([
    { id: "failed", goal: "Run a failing check", maxAttempts: 1 },
    { id: "dependent", goal: "Use the check result", dependencies: ["failed"] },
    { id: "expired", goal: "Old work", deadline: "2000-01-01T00:00:00.000Z" },
  ]);
  const result = await runAutonomousTasks({
    execute: async () => ({ status: "failed", reason: "verification failed" }),
  });
  assert.equal(result.tasks.find((task) => task.id === "failed").status, "failed");
  assert.equal(result.tasks.find((task) => task.id === "dependent").status, "blocked");
  assert.match(result.tasks.find((task) => task.id === "dependent").blocker, /Dependency failed/);
  assert.equal(result.tasks.find((task) => task.id === "expired").status, "blocked");
});

test("parses JSON and task-list YAML without external dependencies", async (t) => {
  await withRoot(t);
  assert.equal((await parseTaskInput('{"goal":"one"}')).goal, "one");
  const yaml = await parseTaskInput(
    "tasks:\n- id: one\n  goal: First task\n- id: two\n  goal: Second task\n  dependencies: [one]\n",
    "yaml",
  );
  assert.equal(yaml.length, 2);
  assert.deepEqual(yaml[1].dependencies, ["one"]);
});

test("rejects cyclic queues", () => {
  const queue = createTaskQueue();
  queue.tasks = [
    {
      id: "a",
      goal: "a",
      priority: "normal",
      dependencies: ["b"],
      status: "queued",
      contract: {
        schemaVersion: "0.1.0",
        record_type: "task_contract",
        goal: "a",
        context_used: [],
        assumptions: [],
        constraints: [],
        risk: "medium",
        verification: [],
        stop_condition: "done",
        persist: true,
        created_at: new Date().toISOString(),
      },
    },
    {
      id: "b",
      goal: "b",
      priority: "normal",
      dependencies: ["a"],
      status: "queued",
      contract: {
        schemaVersion: "0.1.0",
        record_type: "task_contract",
        goal: "b",
        context_used: [],
        assumptions: [],
        constraints: [],
        risk: "medium",
        verification: [],
        stop_condition: "done",
        persist: true,
        created_at: new Date().toISOString(),
      },
    },
  ];
  assert.throws(() => validateTaskQueue(queue), /cyclic/);
});

test("requeues persisted running tasks after an interrupted process", async (t) => {
  await withRoot(t);
  await enqueueAutonomousTasks({ id: "interrupted", goal: "Resume interrupted work" });
  const queuePath = path.join(process.env.MA_ROOT, ".ma", "tasks", "autonomous-queue.json");
  const queue = JSON.parse(await fs.readFile(queuePath, "utf8"));
  queue.tasks[0].status = "running";
  await fs.writeFile(queuePath, `${JSON.stringify(queue, null, 2)}\n`);

  const result = await runAutonomousTasks({
    execute: async (task) => ({ status: "completed", evidence: [`resumed:${task.id}`] }),
  });
  assert.equal(result.tasks[0].status, "completed");
  assert.match(result.tasks[0].evidence.at(-1), /resumed:interrupted/);
});

test("caps concurrent dispatches by the remaining max-tasks budget", async (t) => {
  await withRoot(t);
  await enqueueAutonomousTasks([
    { id: "one", goal: "First task" },
    { id: "two", goal: "Second task" },
    { id: "three", goal: "Third task" },
  ]);
  const calls = [];
  const result = await runAutonomousTasks({
    concurrency: 3,
    maxTasks: 1,
    execute: async (task) => {
      calls.push(task.id);
      return { status: "completed" };
    },
  });
  assert.equal(calls.length, 1);
  assert.equal(result.summary.completed, 1);
});

test("serializes concurrent queue enqueues without dropping tasks", async (t) => {
  await withRoot(t);
  await Promise.all([
    enqueueAutonomousTasks({ id: "first", goal: "First task" }),
    enqueueAutonomousTasks({ id: "second", goal: "Second task" }),
  ]);
  const result = await runAutonomousTasks({ execute: async () => ({ status: "completed" }) });
  assert.deepEqual(result.tasks.map((task) => task.id).sort(), ["first", "second"]);
});
