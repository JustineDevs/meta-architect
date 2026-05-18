import { readJson, writeJson } from "./fs-utils.js";
import { getRuntimeReadPath, getRuntimeWritePath } from "./paths.js";
import { guardLeaderMutation } from "./runtime/runtime-state.js";

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

export async function appendDecision(entry, options = {}) {
  const guard = await guardLeaderMutation({
    actor: options.actor,
    kind: "decision-append",
    payload: entry,
  });
  if (!guard.allowed) {
    return { proposed: true, proposalPath: guard.proposalPath };
  }

  validateDecisionShape(entry);
  const log = await loadDecisionLog();
  log.decisions.push({
    ...entry,
    timestamp: new Date().toISOString(),
  });

  await writeJson(getRuntimeWritePath("decisions.json"), log);
  return { proposed: false, proposalPath: null };
}
