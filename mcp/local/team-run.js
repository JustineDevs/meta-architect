import fs from "node:fs/promises";
import {
  controlTask,
  getTask,
  getTaskMailboxRoot,
  listMaestroTasks,
  listTasks,
  loadTaskRegistry,
  submitTask,
} from "../../src/runtime/orchestrator.js";

const teamRunResources = [
  "team-run://tasks",
  "team-run://maestro-tasks",
  "team-run://registry",
  "team-run://mailbox",
];
const teamRunTools = [
  "team_run.submit_task",
  "team_run.get_status",
  "team_run.list_tasks",
  "team_run.wait_task",
  "team_run.control_task",
];
const terminalTaskStatuses = new Set(["done", "blocked", "cancelled"]);

export function listTeamRunResources() {
  return [...teamRunResources];
}

export function listTeamRunTools() {
  return [...teamRunTools];
}

export async function readTeamRunResource(uri) {
  if (uri === "team-run://tasks") {
    return listTasks();
  }
  if (uri === "team-run://maestro-tasks") {
    return listMaestroTasks();
  }
  if (uri === "team-run://registry") {
    return loadTaskRegistry();
  }
  if (uri === "team-run://mailbox") {
    return fs.readdir(getTaskMailboxRoot());
  }

  throw new Error(`Unknown team_run resource: ${uri}`);
}

export async function callTeamRunTool(name, args = {}, options = {}) {
  const localOptions = { ...options, actor: "local-capability:team_run" };
  if (name === "team_run.submit_task") {
    return submitTask(args.task ?? args, localOptions);
  }
  if (name === "team_run.get_status") {
    return getTask(args.taskId);
  }
  if (name === "team_run.list_tasks") {
    return args.managerOwner === "$maestro" ? listMaestroTasks() : listTasks();
  }
  if (name === "team_run.wait_task") {
    return waitForTask(args.taskId, args);
  }
  if (name === "team_run.control_task") {
    return controlTask(args.taskId, args.action, localOptions);
  }

  throw new Error(`Unknown team_run tool: ${name}`);
}

export async function waitForTask(taskId, { timeoutMs = 1_000, pollMs = 50 } = {}) {
  if (typeof taskId !== "string" || taskId.trim() === "") {
    throw new Error("team_run.wait_task requires a taskId");
  }

  const boundedTimeoutMs = Math.max(0, Math.min(Number(timeoutMs) || 0, 30_000));
  const boundedPollMs = Math.max(10, Math.min(Number(pollMs) || 50, 1_000));
  const startedAt = Date.now();

  while (Date.now() - startedAt <= boundedTimeoutMs) {
    const task = await getTask(taskId);
    if (terminalTaskStatuses.has(task.status)) {
      return {
        record_type: "team_run_wait_result",
        terminal: true,
        timed_out: false,
        task,
      };
    }

    if (boundedTimeoutMs === 0) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, boundedPollMs));
  }

  return {
    record_type: "team_run_wait_result",
    terminal: false,
    timed_out: true,
    task: await getTask(taskId),
  };
}

export async function checkTeamRunCapability() {
  const registry = await readTeamRunResource("team-run://registry");
  return {
    ready: Array.isArray(registry.tasks),
    detail: `task registry loaded with ${registry.tasks.length} task(s)`,
  };
}
