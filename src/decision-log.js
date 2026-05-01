import { readJson, writeJson } from "./fs-utils.js";
import { getRuntimeReadPath, getRuntimeWritePath } from "./paths.js";

function validateDecisionShape(entry) {
  const required = ["decision", "status", "evidence", "blockers", "next_allowed_triggers"];
  for (const field of required) {
    if (!(field in entry)) {
      throw new Error(`Decision entry missing field: ${field}`);
    }
  }
}

export async function loadDecisionLog() {
  const parsed = await readJson(getRuntimeReadPath("decisions.json"));

  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.decisions)) {
    throw new Error("Decision log must be an object with a decisions array");
  }

  return parsed;
}

export async function appendDecision(entry) {
  validateDecisionShape(entry);
  const log = await loadDecisionLog();
  log.decisions.push({
    ...entry,
    timestamp: new Date().toISOString(),
  });

  await writeJson(getRuntimeWritePath("decisions.json"), log);
}

export async function updateDecisionStatuses(statusUpdates) {
  const log = await loadDecisionLog();
  for (const [field, value] of Object.entries(statusUpdates)) {
    log[field] = value;
  }
  await writeJson(getRuntimeWritePath("decisions.json"), log);
}
