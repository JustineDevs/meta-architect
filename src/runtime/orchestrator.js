import { randomUUID } from "node:crypto";
import { ensureDir, readJson, writeFileIfMissing, writeJson } from "../fs-utils.js";
import { getRuntimeSubsystemPath } from "../paths.js";
import { guardLeaderMutation } from "./runtime-state.js";

export function getTaskRoot() {
  return getRuntimeSubsystemPath("tasks");
}

export function getTaskRegistryPath() {
  return getRuntimeSubsystemPath("tasks", "registry.json");
}

export function getTaskMailboxRoot() {
  return getRuntimeSubsystemPath("tasks", "mailbox");
}

export function getTaskLockRoot() {
  return getRuntimeSubsystemPath("tasks", "locks");
}

function validateTaskRegistry(registry) {
  if (
    !registry ||
    typeof registry !== "object" ||
    typeof registry.leader !== "string" ||
    !Array.isArray(registry.workers) ||
    !Array.isArray(registry.tasks)
  ) {
    throw new Error("Task registry must contain leader, workers, and tasks");
  }

  return registry;
}

function normalizeTask(task) {
  const title = task?.title?.trim();
  if (!title) {
    throw new Error("team_run.submit_task requires a task title");
  }

  const metadata =
    task?.metadata && typeof task.metadata === "object" && !Array.isArray(task.metadata)
      ? { ...task.metadata }
      : {};

  return {
    id: task.id ?? `task-${randomUUID()}`,
    title,
    status: task.status ?? "queued",
    owner: task.owner ?? null,
    createdAt: task.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {
      classification: metadata.classification ?? "durable-team-task",
      ...metadata,
    },
  };
}

export async function seedOrchestratorArtifacts() {
  await ensureDir(getTaskRoot());
  await ensureDir(getTaskMailboxRoot());
  await ensureDir(getTaskLockRoot());
  await writeFileIfMissing(
    getTaskRegistryPath(),
    `${JSON.stringify(
      {
        schemaVersion: "0.1.0",
        leader: "leader",
        workers: [],
        tasks: [],
      },
      null,
      2,
    )}\n`,
  );
}

export async function loadTaskRegistry() {
  return validateTaskRegistry(await readJson(getTaskRegistryPath()));
}

export async function saveTaskRegistry(registry) {
  validateTaskRegistry(registry);
  await writeJson(getTaskRegistryPath(), registry);
  return registry;
}

export async function submitTask(task, options = {}) {
  const guard = await guardLeaderMutation({
    actor: options.actor,
    kind: "team-run-submit",
    payload: task,
  });
  if (!guard.allowed) {
    return { proposed: true, proposalPath: guard.proposalPath };
  }

  const registry = await loadTaskRegistry();
  const nextTask = normalizeTask(task);
  registry.tasks.push(nextTask);
  await saveTaskRegistry(registry);
  return { proposed: false, proposalPath: null, task: nextTask };
}

export async function getTask(taskId) {
  const registry = await loadTaskRegistry();
  const task = registry.tasks.find((entry) => entry.id === taskId);
  if (!task) {
    throw new Error(`Unknown task: ${taskId}`);
  }

  return task;
}

export async function listTasks() {
  const registry = await loadTaskRegistry();
  return registry.tasks;
}

export async function listMaestroTasks() {
  const tasks = await listTasks();
  return tasks.filter((task) => task.metadata?.managerOwner === "$maestro");
}

export async function controlTask(taskId, action, options = {}) {
  const guard = await guardLeaderMutation({
    actor: options.actor,
    kind: "team-run-control",
    payload: { taskId, action },
  });
  if (!guard.allowed) {
    return { proposed: true, proposalPath: guard.proposalPath };
  }

  const registry = await loadTaskRegistry();
  const task = registry.tasks.find((entry) => entry.id === taskId);
  if (!task) {
    throw new Error(`Unknown task: ${taskId}`);
  }

  const statusByAction = {
    start: "running",
    complete: "done",
    block: "blocked",
    cancel: "cancelled",
  };
  const nextStatus = statusByAction[action];
  if (!nextStatus) {
    throw new Error(`Unsupported team_run control action: ${action}`);
  }

  task.status = nextStatus;
  task.updatedAt = new Date().toISOString();
  await saveTaskRegistry(registry);
  return { proposed: false, proposalPath: null, task };
}
