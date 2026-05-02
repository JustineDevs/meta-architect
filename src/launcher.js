import { spawnSync } from "node:child_process";
import path from "node:path";

const nativeCommands = new Set([
  "setup",
  "init",
  "idea",
  "skills",
  "sdk-path",
  "status",
  "merge",
  "release",
  "run",
]);

export function shouldDelegateToCodex(args) {
  if (args.length === 0) {
    return true;
  }

  return !nativeCommands.has(args[0]);
}

function normalizeCodexArgs(args) {
  return args.filter((arg) => arg !== "--madmax" && arg !== "--high");
}

function resolveCodexCommand() {
  if (process.env.MA_CODEX_BIN) {
    return process.env.MA_CODEX_BIN;
  }

  return "codex";
}

export function runCodex(args) {
  const codexCommand = resolveCodexCommand();
  const codexArgs = normalizeCodexArgs(args);
  const commandArgs =
    path.extname(codexCommand) === ".js" || path.extname(codexCommand) === ".mjs"
      ? [codexCommand, ...codexArgs]
      : codexArgs;
  const command = commandArgs[0] === codexCommand ? process.execPath : codexCommand;
  const finalArgs = command === process.execPath ? commandArgs : codexArgs;
  const result = spawnSync(command, finalArgs, { stdio: "inherit" });

  if (result.error) {
    if (result.error.code === "ENOENT") {
      throw new Error("Codex not found. Install it with: npm install -g @openai/codex");
    }

    throw new Error(`Failed to start Codex: ${result.error.message}`);
  }

  return typeof result.status === "number" ? result.status : 1;
}
