import { spawnSync } from "node:child_process";
import path from "node:path";

const definitions = {
  codex: {
    id: "codex",
    displayName: "Codex CLI",
    skillsDir: ".agents/skills",
    globalSkillsDir: "~/.agents/skills",
    isUniversal: true,
    command: "codex",
  },
  "claude-code": {
    id: "claude-code",
    displayName: "Claude Code",
    skillsDir: ".claude/skills",
    globalSkillsDir: "~/.claude/skills",
    isUniversal: false,
    command: "claude",
  },
  cursor: {
    id: "cursor",
    displayName: "Cursor",
    skillsDir: ".cursor/skills",
    globalSkillsDir: "~/.cursor/skills",
    isUniversal: false,
    command: "cursor",
  },
  universal: {
    id: "universal",
    displayName: "Universal Agent Skills",
    skillsDir: ".agents/skills",
    globalSkillsDir: "~/.agents/skills",
    isUniversal: true,
    command: null,
  },
};

export const agentRegistry = Object.freeze(
  Object.fromEntries(
    Object.entries(definitions).map(([id, definition]) => [id, Object.freeze(definition)]),
  ),
);

export function getAgent(type = process.env.MA_AGENT || "codex") {
  return agentRegistry[type] ?? agentRegistry.codex;
}

export function getNonUniversalAgents() {
  return Object.values(agentRegistry).filter((agent) => !agent.isUniversal);
}

export function isUniversalAgent(type) {
  return getAgent(type).isUniversal;
}

export function resolveAgentCommand(type = process.env.MA_AGENT || "codex") {
  const agent = getAgent(type);
  if (!agent.command) return null;
  const envKey = `MA_${agent.id.replaceAll("-", "_").toUpperCase()}_BIN`;
  return process.env[envKey]?.trim() || agent.command;
}

export function detectInstalled(type = process.env.MA_AGENT || "codex") {
  const agent = getAgent(type);
  const command = resolveAgentCommand(agent.id);
  if (!command) return { ...agent, installed: false, command: null, version: "" };
  const script = [".js", ".mjs", ".cjs"].includes(path.extname(command));
  const result = spawnSync(
    script ? process.execPath : command,
    script ? [command, "--version"] : ["--version"],
    {
      encoding: "utf8",
    },
  );
  return {
    ...agent,
    command,
    installed: result.status === 0,
    version: result.status === 0 ? result.stdout.trim() : "",
    error: result.error?.message || result.stderr?.trim() || "",
  };
}

export function listAgents() {
  return Object.values(agentRegistry);
}
