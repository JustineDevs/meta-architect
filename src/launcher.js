import { spawnSync } from "node:child_process";
import path from "node:path";
import { getAgent, resolveAgentCommand } from "./agents.js";

const nativeCommands = new Set([
  "bootstrap",
  "doctor",
  "setup",
  "migrate",
  "init",
  "idea",
  "skills",
  "core-ingest",
  "agent-compat",
  "obsidian",
  "obsidian-index",
  "sdk-path",
  "status",
  "verify",
  "merge",
  "release",
  "run",
  "task",
  "hook",
]);

export function shouldDelegateToAgent(args) {
  if (args.length === 0) {
    return true;
  }

  return !nativeCommands.has(args[0]);
}

function normalizeAgentArgs(args) {
  return args.filter((arg) => arg !== "--madmax" && arg !== "--high");
}

export function runAgent(args, agentType = process.env.MA_AGENT || "codex") {
  const agent = getAgent(agentType);
  const agentCommand = resolveAgentCommand(agent.id);
  if (!agentCommand) throw new Error(`Agent "${agent.id}" has no executable command`);
  const agentArgs = normalizeAgentArgs(args);
  const commandArgs = [".js", ".mjs", ".cjs"].includes(path.extname(agentCommand))
    ? [agentCommand, ...agentArgs]
    : agentArgs;
  const command = commandArgs[0] === agentCommand ? process.execPath : agentCommand;
  const finalArgs = command === process.execPath ? commandArgs : agentArgs;
  const result = spawnSync(command, finalArgs, { stdio: "inherit" });

  if (result.error) {
    if (result.error.code === "ENOENT") {
      throw new Error(`${agent.displayName} not found. Install the selected agent and retry.`);
    }

    throw new Error(`Failed to start Codex: ${result.error.message}`);
  }

  return typeof result.status === "number" ? result.status : 1;
}

export const shouldDelegateToCodex = shouldDelegateToAgent;
export function runCodex(args) {
  return runAgent(args, "codex");
}
