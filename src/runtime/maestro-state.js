import { randomUUID } from "node:crypto";
import { readJson, writeFileIfMissing, writeJson } from "../fs-utils.js";
import { getRuntimeStatePath } from "../paths.js";

const defaultDependencyGraph = {
  description: "Topological map of gate execution dependencies.",
  nodes: {
    $arch: { dependencies: [] },
    $sage: { dependencies: ["$arch"] },
    $flow: { dependencies: ["$sage"] },
    $vet: { dependencies: ["$sage"] },
    $vibe: { dependencies: ["$sage"] },
    $build: { dependencies: ["$flow", "$vet", "$vibe"] },
  },
};

const validGlobalStatuses = new Set([
  "IDLE",
  "READY",
  "RUNNING",
  "COMPLETED",
  "DEGRADED_HEALING",
  "LOCKED",
]);

export function getMaestroStatePath() {
  return getRuntimeStatePath("maestro-state.json");
}

export function createDefaultMaestroState() {
  return {
    schemaVersion: "0.1.0",
    orchestration_id: null,
    timestamp: null,
    global_status: "IDLE",
    configuration: {
      auto_heal: false,
      max_healing_attempts: 2,
      concurrency_limit: 4,
    },
    dependency_graph: defaultDependencyGraph,
    runtime_tracks: {},
    downstream_lock_table: {},
  };
}

export function validateMaestroState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("Maestro state must be an object");
  }
  if (state.schemaVersion !== "0.1.0") {
    throw new Error(`Unsupported maestro state schemaVersion: ${state.schemaVersion}`);
  }
  if (!(state.orchestration_id === null || typeof state.orchestration_id === "string")) {
    throw new Error("maestro_state.orchestration_id must be null or a string");
  }
  if (!(state.timestamp === null || typeof state.timestamp === "string")) {
    throw new Error("maestro_state.timestamp must be null or a string");
  }
  if (!validGlobalStatuses.has(state.global_status)) {
    throw new Error(`Unsupported maestro_state.global_status: ${state.global_status}`);
  }
  if (!state.configuration || typeof state.configuration !== "object") {
    throw new Error("maestro_state.configuration must be an object");
  }
  if (!state.dependency_graph || typeof state.dependency_graph !== "object") {
    throw new Error("maestro_state.dependency_graph must be an object");
  }
  if (!state.runtime_tracks || typeof state.runtime_tracks !== "object") {
    throw new Error("maestro_state.runtime_tracks must be an object");
  }
  if (!state.downstream_lock_table || typeof state.downstream_lock_table !== "object") {
    throw new Error("maestro_state.downstream_lock_table must be an object");
  }

  return state;
}

export async function seedMaestroStateArtifacts() {
  await writeFileIfMissing(
    getMaestroStatePath(),
    `${JSON.stringify(createDefaultMaestroState(), null, 2)}\n`,
  );
}

export async function loadMaestroState() {
  return validateMaestroState(await readJson(getMaestroStatePath()));
}

export async function loadMaestroStateOrDefault() {
  try {
    return await loadMaestroState();
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return createDefaultMaestroState();
    }

    throw error;
  }
}

export async function saveMaestroState(state) {
  validateMaestroState(state);
  await writeJson(getMaestroStatePath(), state);
  return state;
}

export function beginMaestroOrchestration(state, { globalStatus, configuration = null } = {}) {
  const next = structuredClone(state);
  if (
    next.orchestration_id === null ||
    ["IDLE", "COMPLETED", "LOCKED"].includes(next.global_status)
  ) {
    next.orchestration_id = `ma_run_${Date.now()}_${randomUUID().slice(0, 8)}`;
  }
  next.timestamp = new Date().toISOString();
  next.global_status = globalStatus;
  if (configuration) {
    next.configuration = {
      ...next.configuration,
      ...configuration,
    };
  }
  return next;
}
