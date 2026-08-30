import path from "node:path";
import { safeSpawnSync } from "./process-utils.js";

const definitions = {
  codex: {
    id: "codex",
    displayName: "Codex CLI",
    skillsDir: ".agents/skills",
    globalSkillsDir: "~/.agents/skills",
    isUniversal: true,
    command: "codex",
    surface: "cli",
    vendor: "openai",
    probeable: true,
  },
  "claude-code": {
    id: "claude-code",
    displayName: "Claude Code",
    skillsDir: ".claude/skills",
    globalSkillsDir: "~/.claude/skills",
    isUniversal: false,
    command: "claude",
    surface: "cli",
    vendor: "anthropic",
    probeable: true,
  },
  cursor: {
    id: "cursor",
    displayName: "Cursor",
    skillsDir: ".agents/skills",
    globalSkillsDir: "~/.agents/skills",
    isUniversal: true,
    command: "cursor",
    surface: "ide",
    vendor: "cursor",
    probeable: true,
  },
  opencode: {
    id: "opencode",
    displayName: "OpenCode",
    skillsDir: ".agents/skills",
    globalSkillsDir: "~/.config/opencode/skills",
    isUniversal: true,
    command: "opencode",
    surface: "cli",
    vendor: "sst",
    probeable: true,
  },
  "gemini-cli": {
    id: "gemini-cli",
    displayName: "Gemini CLI",
    skillsDir: ".agents/skills",
    globalSkillsDir: "~/.gemini/skills",
    isUniversal: true,
    command: "gemini",
    surface: "cli",
    vendor: "google",
    probeable: true,
  },
  amp: {
    id: "amp",
    displayName: "Amp",
    skillsDir: ".agents/skills",
    globalSkillsDir: "~/.config/agents/skills",
    isUniversal: true,
    command: "amp",
    surface: "cli",
    vendor: "sourcegraph",
    probeable: true,
  },
  goose: {
    id: "goose",
    displayName: "Goose",
    skillsDir: ".goose/skills",
    globalSkillsDir: "~/.config/goose/skills",
    isUniversal: false,
    command: "goose",
    surface: "cli",
    vendor: "block",
    probeable: true,
  },
  "hermes-agent": {
    id: "hermes-agent",
    displayName: "Hermes Agent",
    skillsDir: ".hermes/skills",
    globalSkillsDir: "~/.hermes/skills",
    isUniversal: false,
    command: "hermes",
    surface: "cli",
    vendor: "nous-research",
    probeable: true,
  },
  pi: {
    id: "pi",
    displayName: "Pi Coding Agent",
    skillsDir: ".pi/skills",
    globalSkillsDir: "~/.pi/agent/skills",
    isUniversal: false,
    command: "pi",
    surface: "cli",
    vendor: "pi",
    probeable: true,
  },
  windsurf: {
    id: "windsurf",
    displayName: "Windsurf",
    skillsDir: ".windsurf/skills",
    globalSkillsDir: "~/.codeium/windsurf/skills",
    isUniversal: false,
    command: null,
    surface: "ide",
    vendor: "windsurf",
    probeable: false,
  },
  cline: {
    id: "cline",
    displayName: "Cline",
    skillsDir: ".agents/skills",
    globalSkillsDir: "~/.agents/skills",
    isUniversal: true,
    command: null,
    surface: "ide",
    vendor: "cline",
    probeable: false,
  },
  continue: {
    id: "continue",
    displayName: "Continue",
    skillsDir: ".continue/skills",
    globalSkillsDir: "~/.continue/skills",
    isUniversal: false,
    command: "continue",
    surface: "ide",
    vendor: "continue",
    probeable: true,
  },
  roo: {
    id: "roo",
    displayName: "Roo Code",
    skillsDir: ".roo/skills",
    globalSkillsDir: "~/.roo/skills",
    isUniversal: false,
    command: null,
    surface: "ide",
    vendor: "roo-code",
    probeable: false,
  },
  "kiro-cli": {
    id: "kiro-cli",
    displayName: "Kiro CLI",
    skillsDir: ".kiro/skills",
    globalSkillsDir: "~/.kiro/skills",
    isUniversal: false,
    command: "kiro",
    surface: "ide",
    vendor: "amazon",
    probeable: true,
  },
  junie: {
    id: "junie",
    displayName: "Junie",
    skillsDir: ".junie/skills",
    globalSkillsDir: "~/.junie/skills",
    isUniversal: false,
    command: null,
    surface: "ide",
    vendor: "jetbrains",
    probeable: false,
  },
  "github-copilot": {
    id: "github-copilot",
    displayName: "GitHub Copilot",
    skillsDir: ".agents/skills",
    globalSkillsDir: "~/.copilot/skills",
    isUniversal: true,
    command: null,
    surface: "ide",
    vendor: "github",
    probeable: false,
  },
  antigravity: {
    id: "antigravity",
    displayName: "Antigravity",
    skillsDir: ".agents/skills",
    globalSkillsDir: "~/.gemini/antigravity/skills",
    isUniversal: true,
    command: null,
    surface: "ide",
    vendor: "google",
    probeable: false,
  },
  universal: {
    id: "universal",
    displayName: "Universal Agent Skills",
    skillsDir: ".agents/skills",
    globalSkillsDir: "~/.agents/skills",
    isUniversal: true,
    command: null,
    surface: "generic",
    vendor: "universal",
    probeable: false,
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
  if (!command || !agent.probeable) {
    return {
      ...agent,
      installed: false,
      command: command ?? null,
      version: "",
      probe: "unsupported",
    };
  }
  const script = [".js", ".mjs", ".cjs"].includes(path.extname(command));
  const result = safeSpawnSync(
    script ? process.execPath : command,
    script ? [command, "--version"] : ["--version"],
    {
      encoding: "utf8",
      shell: false,
      timeout: 5_000,
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

const slashInvocationAgents = new Set([
  "cursor",
  "windsurf",
  "cline",
  "continue",
  "roo",
  "kiro-cli",
  "junie",
  "github-copilot",
  "antigravity",
]);

export function getAgentInvocation(type, command = "maestro") {
  if (type === "codex") return `$${command}`;
  if (slashInvocationAgents.has(type)) return `/${command}`;
  return command;
}
