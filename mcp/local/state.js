import { appendDecision } from "../../src/decision-log.js";
import { loadManagerRunRegistryOrDefault } from "../../src/runtime/maestro-manager.js";
import { withMcpWriteGate } from "../../src/runtime/mcp-authority.js";
import { createRuntimeSummary, loadRuntimeSnapshot } from "../../src/runtime/runtime-state.js";
import { loadCombinedState, syncStatusUpdates } from "../../src/state-sync.js";

const stateResources = [
  "state://runtime/snapshot",
  "state://manager/runs",
  "state://release",
  "state://decisions",
  "state://combined",
];
const stateTools = ["state.sync_release_status", "state.append_decision"];

export function listStateResources() {
  return [...stateResources];
}

export function listStateTools() {
  return [...stateTools];
}

export async function readStateResource(uri) {
  if (uri === "state://runtime/snapshot") {
    const snapshot = await loadRuntimeSnapshot();
    return { snapshot, summary: createRuntimeSummary(snapshot) };
  }

  if (uri === "state://manager/runs") {
    return loadManagerRunRegistryOrDefault();
  }

  const combined = await loadCombinedState();
  if (uri === "state://release") {
    return combined.release;
  }
  if (uri === "state://decisions") {
    return combined.decisions;
  }
  if (uri === "state://combined") {
    return combined;
  }

  throw new Error(`Unknown _state resource: ${uri}`);
}

export async function callStateTool(name, args = {}, options = {}) {
  if (name === "state.sync_release_status") {
    const statusUpdates = args.statusUpdates ?? args;
    return withMcpWriteGate({ tool: name, options, payload: statusUpdates }, (metadata) =>
      syncStatusUpdates(statusUpdates, metadata),
    );
  }

  if (name === "state.append_decision") {
    const entry = args.entry ?? args;
    return withMcpWriteGate({ tool: name, options, payload: entry }, (metadata) =>
      appendDecision(entry, metadata),
    );
  }

  throw new Error(`Unknown _state tool: ${name}`);
}

export async function checkStateCapability() {
  const [snapshot, managerRuns] = await Promise.all([
    readStateResource("state://runtime/snapshot"),
    readStateResource("state://manager/runs"),
  ]);
  return {
    ready: true,
    detail: `runtime summary loaded with ${snapshot.summary.decisionCount} recorded decision(s) and ${managerRuns.runs.length} manager run(s)`,
  };
}
