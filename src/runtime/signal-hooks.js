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
        activeAutonomy: {
          enabled: true,
          stopPolicy: "block_passive_permission_handoff_when_auto_continue_applies",
          defaultResponse:
            "AUTO-CONTINUE: continue the current safe branch, execute the next reversible step, then verify before reporting.",
          stallPatterns: [
            "should i proceed",
            "would you like me to continue",
            "if you want, i can",
            "if you'd like, i can",
            "tell me if you want me to",
            "i can continue if you want",
            "let me know if you want me to continue",
          ],
        },
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
