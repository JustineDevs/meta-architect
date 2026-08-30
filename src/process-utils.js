import { execFile, execFileSync, spawn, spawnSync } from "node:child_process";

const unsafeExecutable = /[;&|<>`$]/;

export function assertSafeExecutable(command, label = "Executable") {
  if (
    typeof command !== "string" ||
    command.trim() === "" ||
    command !== command.trim() ||
    command.includes("\0") ||
    command.includes("\r") ||
    command.includes("\n") ||
    unsafeExecutable.test(command) ||
    /\s/.test(command)
  ) {
    throw new Error(`${label} contains an unsafe executable value`);
  }
  return command;
}

function assertArgs(args) {
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== "string" || arg.includes("\0")))
    throw new Error("Process arguments must be an array of strings without NUL bytes");
}

function safeOptions(options = {}) {
  return { ...options, shell: false };
}

export function safeSpawn(command, args = [], options = {}) {
  assertSafeExecutable(command);
  assertArgs(args);
  return spawn(command, args, safeOptions(options));
}

export function safeSpawnSync(command, args = [], options = {}) {
  assertSafeExecutable(command);
  assertArgs(args);
  return spawnSync(command, args, safeOptions(options));
}

export function safeExecFile(command, args = [], options = {}) {
  assertSafeExecutable(command);
  assertArgs(args);
  return execFile(command, args, safeOptions(options));
}

export function safeExecFileSync(command, args = [], options = {}) {
  assertSafeExecutable(command);
  assertArgs(args);
  return execFileSync(command, args, safeOptions(options));
}
