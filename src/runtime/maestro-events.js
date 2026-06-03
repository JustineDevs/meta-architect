import fs from "node:fs/promises";
import { getRuntimeSubsystemPath } from "../paths.js";

export function getMaestroEventsPath() {
  return getRuntimeSubsystemPath("logs", "maestro-events.ndjson");
}

export async function appendMaestroEvent(record) {
  const event = {
    schemaVersion: "0.1.0",
    timestamp: new Date().toISOString(),
    ...record,
  };
  const target = getMaestroEventsPath();
  await fs.mkdir(getRuntimeSubsystemPath("logs"), { recursive: true });
  await fs.appendFile(target, `${JSON.stringify(event)}\n`, "utf8");
  return event;
}
