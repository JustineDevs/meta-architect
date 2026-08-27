import path from "node:path";
import { ensureDir, readJson, writeJson } from "../fs-utils.js";
import { getRuntimeSubsystemPath } from "../paths.js";

export const handoffPacketSchemaVersion = "0.1.0";

export function getHandoffPacketRoot() {
  return getRuntimeSubsystemPath("tasks", "handoffs");
}

function safePacketId(id) {
  if (String(id ?? "").includes("/") || String(id ?? "").includes("\\"))
    throw new Error("handoff packet id is required");
  const safe = String(id ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-");
  if (!safe || safe === "." || safe === "..") throw new Error("handoff packet id is required");
  return safe;
}

export function createHandoffPacket({
  goal,
  currentState,
  contextUsed = [],
  decisions = [],
  blockers = [],
  risks = [],
  changedFiles = [],
  verification = [],
  nextAction,
  status = "active",
}) {
  if (!goal || !currentState || !nextAction)
    throw new Error("handoff packet requires goal, currentState, and nextAction");
  return validateHandoffPacket({
    schemaVersion: handoffPacketSchemaVersion,
    record_type: "handoff_packet",
    goal,
    current_state: currentState,
    context_used: contextUsed,
    decisions,
    blockers,
    risks,
    changed_files: changedFiles,
    verification,
    next_action: nextAction,
    status,
    created_at: new Date().toISOString(),
  });
}

export function validateHandoffPacket(packet) {
  if (
    !packet ||
    packet.schemaVersion !== handoffPacketSchemaVersion ||
    packet.record_type !== "handoff_packet"
  )
    throw new Error("invalid handoff packet schema");
  for (const field of ["goal", "current_state", "next_action"]) {
    if (typeof packet[field] !== "string" || packet[field].trim() === "")
      throw new Error(`handoff packet requires ${field}`);
  }
  for (const field of [
    "context_used",
    "decisions",
    "blockers",
    "risks",
    "changed_files",
    "verification",
  ]) {
    if (!Array.isArray(packet[field]) || packet[field].some((value) => typeof value !== "string"))
      throw new Error(`handoff packet requires string array: ${field}`);
  }
  if (!["active", "blocked", "verified"].includes(packet.status))
    throw new Error(`Unsupported handoff packet status: ${packet.status}`);
  return packet;
}

export async function writeHandoffPacket(id, packet) {
  const packetId = safePacketId(id);
  const validated = validateHandoffPacket(packet);
  await ensureDir(getHandoffPacketRoot());
  const packetPath = path.join(getHandoffPacketRoot(), `${packetId}.json`);
  await writeJson(packetPath, validated);
  return packetPath;
}

export async function loadHandoffPacket(id) {
  return validateHandoffPacket(
    await readJson(path.join(getHandoffPacketRoot(), `${safePacketId(id)}.json`)),
  );
}
