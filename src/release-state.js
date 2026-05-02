import fs from "node:fs/promises";
import { writeJson } from "./fs-utils.js";
import { getRuntimeReadPath, getRuntimeWritePath } from "./paths.js";

const allowedStatuses = {
  idea_status: ["DRAFT", "CLEAR", "BLOCKED"],
  architecture_status: ["DRAFT", "REVIEWED", "APPROVED"],
  evidence_status: ["MISSING", "PARTIAL", "VERIFIED"],
  logic_status: ["PENDING", "GREEN", "RED"],
  security_status: ["PENDING", "GREEN", "RED"],
  experience_status: ["PENDING", "GREEN", "RED", "WAIVED"],
  build_status: ["LOCKED", "READY", "RUNNING", "DONE"],
  merge_status: ["LOCKED", "READY", "MERGED_TO_DEVELOPMENT"],
  release_status: ["LOCKED", "READY", "SHIPPED_TO_PROD"],
};

function validateWaiver(state) {
  if (state.experience_status !== "WAIVED") {
    return;
  }

  const waiver = state.waiver;
  if (!waiver?.reason || !waiver.actor || !waiver.timestamp) {
    throw new Error(
      "experience_status=WAIVED requires waiver.reason, waiver.actor, and waiver.timestamp",
    );
  }
}

export function validateReleaseState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("Release state must be an object");
  }

  for (const [field, allowed] of Object.entries(allowedStatuses)) {
    if (!allowed.includes(state[field])) {
      throw new Error(`Invalid ${field}: ${state[field]}`);
    }
  }

  validateWaiver(state);
  return state;
}

export async function loadReleaseState() {
  const raw = await fs.readFile(getRuntimeReadPath("release.json"), "utf8");
  const parsed = JSON.parse(raw);
  return validateReleaseState(parsed);
}

export async function saveReleaseState(state) {
  validateReleaseState(state);
  const next = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  await writeJson(getRuntimeWritePath("release.json"), next);
  return next;
}
