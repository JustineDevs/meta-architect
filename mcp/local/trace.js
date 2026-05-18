import fs from "node:fs/promises";
import {
  getActiveManagerRun,
  loadManagerRunRegistryOrDefault,
} from "../../src/runtime/maestro-manager.js";
import { getTaskMailboxRoot } from "../../src/runtime/orchestrator.js";
import { createRuntimeSummary, loadRuntimeSnapshot } from "../../src/runtime/runtime-state.js";
import {
  loadRuntimeHooksAuditLog,
  loadRuntimeHooksConfig,
} from "../../src/runtime/signal-hooks.js";

const traceResources = [
  "trace://hooks/audit",
  "trace://hooks/config",
  "trace://runtime/summary",
  "trace://manager/runs",
  "trace://manager/active",
];

export function listTraceResources() {
  return [...traceResources];
}

export async function readTraceResource(uri) {
  if (uri === "trace://hooks/audit") {
    return loadRuntimeHooksAuditLog();
  }
  if (uri === "trace://hooks/config") {
    return loadRuntimeHooksConfig();
  }
  if (uri === "trace://runtime/summary") {
    return createRuntimeSummary(await loadRuntimeSnapshot());
  }
  if (uri === "trace://manager/runs") {
    return loadManagerRunRegistryOrDefault();
  }
  if (uri === "trace://manager/active") {
    const registry = await loadManagerRunRegistryOrDefault();
    return getActiveManagerRun(registry);
  }

  throw new Error(`Unknown trace resource: ${uri}`);
}

export async function listTraceEvents() {
  return fs.readdir(getTaskMailboxRoot());
}

export async function checkTraceCapability() {
  const [audit, summary, managerRuns] = await Promise.all([
    readTraceResource("trace://hooks/audit"),
    readTraceResource("trace://runtime/summary"),
    readTraceResource("trace://manager/runs"),
  ]);
  return {
    ready: typeof audit === "string",
    detail: `trace surfaces loaded; pending mailbox proposals=${summary.pendingMailboxCount}; manager runs=${managerRuns.runs.length}`,
  };
}
