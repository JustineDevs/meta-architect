import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { getAgentInvocation } from "../agents.js";
import { readJson, withRuntimeStateLock, writeFileIfMissing, writeJson } from "../fs-utils.js";
import { getRuntimeSubsystemPath } from "../paths.js";
import { writeJsonAtomically } from "../setup-lifecycle.js";
import {
  createDefaultEnvironmentAwarenessCore,
  discoverEnvironmentCapabilities,
  selectEnvironmentCapabilitiesForTask,
} from "./environment-awareness-core.js";
import { appendMaestroEvent } from "./maestro-events.js";
import { createTaskContract, validateTaskContract } from "./task-contracts.js";

export const autonomousTaskSchemaVersion = "0.1.0";
const statuses = new Set(["queued", "running", "completed", "failed", "blocked", "cancelled"]);
const priorities = new Set(["low", "normal", "high", "critical"]);

export function getAutonomousTaskQueuePath() {
  return getRuntimeSubsystemPath("tasks", "autonomous-queue.json");
}

export function createTaskQueue() {
  return {
    schemaVersion: autonomousTaskSchemaVersion,
    record_type: "autonomous_task_queue",
    tasks: [],
  };
}

export async function seedAutonomousTaskArtifacts() {
  const queuePath = getAutonomousTaskQueuePath();
  await fs.mkdir(path.dirname(queuePath), { recursive: true });
  await writeFileIfMissing(queuePath, `${JSON.stringify(createTaskQueue(), null, 2)}\n`);
}

function normalizeTaskId(value) {
  const id = String(value ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-");
  if (!id || id === "." || id === "..") throw new Error("task id is required");
  return id;
}

function normalizeTask(input) {
  const goal = String(input?.goal ?? input?.title ?? "").trim();
  if (!goal) throw new Error("autonomous task requires goal");
  const id = normalizeTaskId(input?.id ?? `task-${randomUUID().slice(0, 8)}`);
  const priority = input?.priority ?? "normal";
  if (!priorities.has(priority)) throw new Error(`unsupported task priority: ${priority}`);
  const dependencies = Array.isArray(input?.dependencies ?? input?.dependsOn)
    ? [...(input.dependencies ?? input.dependsOn)].map(normalizeTaskId)
    : [];
  const labels = Array.isArray(input?.labels) ? [...new Set(input.labels.map(String))] : [];
  const deadline = input?.deadline ?? null;
  if (deadline && Number.isNaN(Date.parse(deadline)))
    throw new Error("task deadline must be an ISO date");
  const contract = input?.contract
    ? validateTaskContract(input.contract)
    : createTaskContract({
        goal,
        contextUsed: [
          ".ma/context/project-index.json",
          ".ma/context/environment-awareness-core.json",
        ],
        constraints: ["Stop for destructive, credential-gated, or external production actions"],
        verification: ["ma doctor", "Maestro lane receipts"],
        stopCondition: "Complete with verification evidence or record a blocker",
        risk: input?.risk ?? "medium",
      });
  return {
    id,
    goal,
    priority,
    dependencies,
    labels,
    deadline,
    status: input?.status ?? "queued",
    attempts: Number.isInteger(input?.attempts) ? input.attempts : 0,
    maxAttempts: Number.isInteger(input?.maxAttempts) ? Math.max(1, input.maxAttempts) : 3,
    vendor: input?.vendor ?? null,
    contract,
    createdAt: input?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startedAt: input?.startedAt ?? null,
    completedAt: input?.completedAt ?? null,
    error: input?.error ?? null,
    blocker: input?.blocker ?? null,
    evidence: Array.isArray(input?.evidence) ? [...input.evidence] : [],
    selectedCapabilities: Array.isArray(input?.selectedCapabilities)
      ? input.selectedCapabilities
      : [],
  };
}

export function validateTaskQueue(queue) {
  if (
    !queue ||
    queue.schemaVersion !== autonomousTaskSchemaVersion ||
    queue.record_type !== "autonomous_task_queue"
  )
    throw new Error("invalid autonomous task queue schema");
  if (!Array.isArray(queue.tasks)) throw new Error("autonomous task queue requires tasks");
  const ids = new Set();
  for (const task of queue.tasks) {
    if (ids.has(task.id)) throw new Error(`duplicate autonomous task id: ${task.id}`);
    ids.add(task.id);
    if (
      !statuses.has(task.status) ||
      !priorities.has(task.priority) ||
      !Array.isArray(task.dependencies)
    )
      throw new Error(`invalid task state: ${task.id}`);
    validateTaskContract(task.contract);
    if (task.dependencies.some((dependency) => dependency === task.id))
      throw new Error(`task cannot depend on itself: ${task.id}`);
  }
  for (const task of queue.tasks)
    for (const dependency of task.dependencies)
      if (!ids.has(dependency)) throw new Error(`unknown task dependency: ${dependency}`);
  for (const task of queue.tasks) {
    const visiting = new Set();
    const visit = (id) => {
      if (visiting.has(id)) throw new Error(`cyclic task dependency: ${id}`);
      visiting.add(id);
      for (const dependency of byId(queue.tasks).get(id)?.dependencies ?? []) visit(dependency);
      visiting.delete(id);
    };
    visit(task.id);
  }
  return queue;
}

function byId(tasks) {
  return new Map(tasks.map((task) => [task.id, task]));
}

async function loadTaskQueueUnlocked() {
  try {
    const queue = validateTaskQueue(await readJson(getAutonomousTaskQueuePath()));
    const interrupted = queue.tasks.filter((task) => task.status === "running");
    if (interrupted.length === 0) return queue;
    const recoveredAt = new Date().toISOString();
    for (const task of interrupted) {
      task.status = "queued";
      task.error = "Recovered after the previous process exited while the task was running";
      task.updatedAt = recoveredAt;
    }
    await writeJsonAtomically(getAutonomousTaskQueuePath(), queue);
    return queue;
  } catch (error) {
    if (error?.code === "ENOENT") return createTaskQueue();
    throw error;
  }
}

export async function loadTaskQueue() {
  return withRuntimeStateLock(getAutonomousTaskQueuePath(), loadTaskQueueUnlocked, { wait: true });
}

export async function saveTaskQueue(queue) {
  await fs.mkdir(path.dirname(getAutonomousTaskQueuePath()), { recursive: true });
  return writeJson(getAutonomousTaskQueuePath(), validateTaskQueue(queue));
}

export async function enqueueAutonomousTasks(inputs) {
  return withRuntimeStateLock(
    getAutonomousTaskQueuePath(),
    async () => {
      const queue = await loadTaskQueueUnlocked();
      const tasks = Array.isArray(inputs) ? inputs : [inputs];
      const added = tasks.map(normalizeTask);
      const existing = new Set(queue.tasks.map((task) => task.id));
      for (const task of added) {
        if (existing.has(task.id)) throw new Error(`task already exists: ${task.id}`);
        existing.add(task.id);
        queue.tasks.push(task);
      }
      await writeJsonAtomically(getAutonomousTaskQueuePath(), validateTaskQueue(queue));
      return added;
    },
    { wait: true },
  );
}

export async function cancelAutonomousTask(id, reason = "Cancelled by operator") {
  return withRuntimeStateLock(
    getAutonomousTaskQueuePath(),
    async () => {
      const queue = await loadTaskQueueUnlocked();
      const task = queue.tasks.find((entry) => entry.id === normalizeTaskId(id));
      if (!task) throw new Error(`unknown autonomous task: ${id}`);
      if (["completed", "cancelled"].includes(task.status)) return task;
      task.status = "cancelled";
      task.blocker = reason;
      task.updatedAt = new Date().toISOString();
      await writeJsonAtomically(getAutonomousTaskQueuePath(), validateTaskQueue(queue));
      return task;
    },
    { wait: true },
  );
}

function hasUnsafeAction(task) {
  return /\b(deploy|production|publish|delete\s+all|drop\s+(database|table)|rotate\s+credentials|send\s+money)\b/i.test(
    task.goal,
  );
}

function dependenciesReady(task, byId) {
  return task.dependencies.every((id) => byId.get(id)?.status === "completed");
}

function isExpired(task, now) {
  return task.deadline && Date.parse(task.deadline) < now;
}

export async function runAutonomousTasks({
  concurrency = 1,
  maxTasks = Infinity,
  includeGlobal = true,
  execute = null,
  cwd = process.cwd(),
  onEvent = null,
} = {}) {
  if (!Number.isInteger(concurrency) || concurrency < 1)
    throw new Error("concurrency must be a positive integer");
  const queue = await loadTaskQueue();
  const byId = new Map(queue.tasks.map((task) => [task.id, task]));
  const capabilities = createDefaultEnvironmentAwarenessCore({
    capabilities: await discoverEnvironmentCapabilities({ cwd, includeGlobal }),
  });
  const runner =
    execute ??
    (async (task) => {
      const { runMaestro } = await import("../skills.js");
      await runMaestro({ taskContract: task.contract, handoff: { nextAction: task.goal } });
      const [{ loadManagerRunRegistryOrDefault }, { loadAlignmentSentinelReport }] =
        await Promise.all([import("./maestro-manager.js"), import("./alignment-sentinel.js")]);
      const [managerRegistry, alignment] = await Promise.all([
        loadManagerRunRegistryOrDefault(),
        loadAlignmentSentinelReport(),
      ]);
      const latestRun = managerRegistry.runs.at(-1);
      if (alignment?.driftStatus === "DRIFTED") {
        return {
          status: "blocked",
          reason: "Maestro blocked dispatch because alignment drift must be resolved",
        };
      }
      if (latestRun && ["waiting-review", "blocked"].includes(latestRun.state)) {
        return {
          status: "blocked",
          reason: `Maestro ${latestRun.state}: ${latestRun.retry?.lastReason ?? "review or blocker remains"}`,
        };
      }
      return { status: "completed", evidence: ["Maestro manager run completed"] };
    });
  const events = [];
  const emit = async (event) => {
    events.push(event);
    await appendMaestroEvent({ record_type: "autonomous_task", ...event });
    await onEvent?.(event);
  };
  const running = new Set();
  let processed = 0;
  while (processed + running.size < maxTasks) {
    const now = Date.now();
    const eligible = queue.tasks
      .filter((task) => task.status === "queued" && !running.has(task.id))
      .filter((task) => !isExpired(task, now) && dependenciesReady(task, byId))
      .sort(
        (a, b) =>
          (priorities.has(b.priority)
            ? ["low", "normal", "high", "critical"].indexOf(b.priority)
            : 0) - ["low", "normal", "high", "critical"].indexOf(a.priority),
      );
    if (eligible.length === 0 || running.size >= concurrency) {
      if (running.size === 0) break;
      await Promise.race(running);
      continue;
    }
    const remaining = maxTasks - processed - running.size;
    for (const task of eligible.slice(0, Math.min(concurrency - running.size, remaining))) {
      task.selectedCapabilities = selectEnvironmentCapabilitiesForTask(
        capabilities,
        task.goal,
      ).selected;
      task.invocation = task.vendor ? getAgentInvocation(task.vendor, "maestro") : null;
      if (hasUnsafeAction(task)) {
        task.status = "blocked";
        task.blocker =
          "Explicit approval required for destructive, production, credential, or external mutation task";
        task.updatedAt = new Date().toISOString();
        await emit({ taskId: task.id, status: task.status, blocker: task.blocker });
        processed++;
        continue;
      }
      task.status = "running";
      task.attempts++;
      task.startedAt ??= new Date().toISOString();
      task.updatedAt = new Date().toISOString();
      const promise = (async () => {
        try {
          const result = await runner(task);
          if (result?.status === "blocked") {
            task.status = "blocked";
            task.blocker = result.reason ?? "Runner reported a blocker";
          } else if (result?.status === "failed" && task.attempts < task.maxAttempts) {
            task.status = "queued";
            task.error = result.reason ?? "Runner failed; task queued for retry";
          } else if (result?.status === "failed") {
            task.status = "failed";
            task.error = result.reason ?? "Runner failed after maximum attempts";
          } else {
            task.status = "completed";
            task.completedAt = new Date().toISOString();
            task.evidence.push(...(Array.isArray(result?.evidence) ? result.evidence : []));
          }
        } catch (error) {
          task.error = error instanceof Error ? error.message : String(error);
          task.status = task.attempts < task.maxAttempts ? "queued" : "failed";
        }
        task.updatedAt = new Date().toISOString();
        await emit({
          taskId: task.id,
          status: task.status,
          attempts: task.attempts,
          error: task.error,
          blocker: task.blocker,
        });
        await saveTaskQueue(queue);
        running.delete(promise);
        processed++;
      })();
      running.add(promise);
      await saveTaskQueue(queue);
    }
  }
  await Promise.all(running);
  for (const task of queue.tasks) {
    if (task.status !== "queued") continue;
    const failedDependency = task.dependencies.find((id) =>
      ["failed", "blocked", "cancelled"].includes(byId.get(id)?.status),
    );
    if (failedDependency) {
      task.status = "blocked";
      task.blocker = `Dependency ${failedDependency} is ${byId.get(failedDependency).status}`;
    } else if (isExpired(task, Date.now())) {
      task.status = "blocked";
      task.blocker = "Task deadline expired";
    } else if (!dependenciesReady(task, byId)) {
      task.blocker = "Waiting for dependencies";
    }
    task.updatedAt = new Date().toISOString();
  }
  await saveTaskQueue(queue);
  return {
    schemaVersion: autonomousTaskSchemaVersion,
    tasks: queue.tasks,
    events,
    summary: summarizeTasks(queue.tasks),
  };
}

export function summarizeTasks(tasks) {
  return Object.fromEntries(
    [...statuses].map((status) => [status, tasks.filter((task) => task.status === status).length]),
  );
}

export async function parseTaskInput(raw, format = "json") {
  if (format === "json" || format === "jsonl") return JSON.parse(raw);
  if (format !== "yaml" && format !== "yml")
    throw new Error(`unsupported task input format: ${format}`);
  const result = [];
  let current = null;
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (trimmed === "tasks:") continue;
    if (trimmed.startsWith("- ")) {
      if (current) result.push(current);
      current = {};
      parseYamlField(current, trimmed.slice(2));
      continue;
    }
    if (!current) current = {};
    parseYamlField(current, trimmed);
  }
  if (current) result.push(current);
  return result.length === 1 ? result[0] : result;
}

function parseYamlField(target, line) {
  const index = line.indexOf(":");
  if (index < 1) throw new Error(`invalid task YAML line: ${line}`);
  const key = line.slice(0, index).trim();
  const value = line.slice(index + 1).trim();
  if (value.startsWith("[") && value.endsWith("]"))
    target[key] = value
      .slice(1, -1)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  else target[key] = value.replace(/^['"]|['"]$/g, "");
}
