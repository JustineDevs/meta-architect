import fs from "node:fs/promises";
import { ensureDir, readJson, writeFileIfMissing } from "../fs-utils.js";
import { getRuntimeSubsystemPath } from "../paths.js";

const runtimeEvents = [
  "prompt_submit",
  "pre_action",
  "post_action",
  "failure",
  "session_start",
  "cwd_changed",
  "file_changed",
  "workspace_created",
];

export function getRuntimeHooksRoot() {
  return getRuntimeSubsystemPath("hooks");
}

export function getRuntimeHooksConfigPath() {
  return getRuntimeSubsystemPath("hooks", "config.json");
}

export function getRuntimeHooksAuditPath() {
  return getRuntimeSubsystemPath("hooks", "audit.log");
}

export async function seedSignalHookArtifacts() {
  await ensureDir(getRuntimeHooksRoot());
  await writeFileIfMissing(
    getRuntimeHooksConfigPath(),
    `${JSON.stringify(
      {
        schemaVersion: "0.1.0",
        compatibilityNamespace: ["prebuild", "prerelease"],
        runtimeNamespace: runtimeEvents,
        hooks: [],
      },
      null,
      2,
    )}\n`,
  );
  await writeFileIfMissing(getRuntimeHooksAuditPath(), "");
}

export async function loadRuntimeHooksConfig() {
  return readJson(getRuntimeHooksConfigPath());
}

export async function loadRuntimeHooksAuditLog() {
  return fs.readFile(getRuntimeHooksAuditPath(), "utf8");
}
