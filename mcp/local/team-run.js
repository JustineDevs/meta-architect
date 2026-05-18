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
const teamRunTools = ["team_run.submit_task", "team_run.get_status", "team_run.control_task"];

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
  if (name === "team_run.control_task") {
    return controlTask(args.taskId, args.action, localOptions);
  }

  throw new Error(`Unknown team_run tool: ${name}`);
}

export async function checkTeamRunCapability() {
  const registry = await readTeamRunResource("team-run://registry");
  return {
    ready: Array.isArray(registry.tasks),
    detail: `task registry loaded with ${registry.tasks.length} task(s)`,
  };
}
