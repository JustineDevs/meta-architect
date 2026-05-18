import fs from "node:fs/promises";
import { ensureDir, readJson, writeFileIfMissing, writeJson } from "../fs-utils.js";
import { getRuntimeSubsystemPath } from "../paths.js";
import { guardLeaderMutation } from "./runtime-state.js";

export function getContinuityRoot() {
  return getRuntimeSubsystemPath("memory");
}

export function getContinuityNotesPath() {
  return getRuntimeSubsystemPath("memory", "notes.md");
}

export function getContinuityIndexPath() {
  return getRuntimeSubsystemPath("memory", "index.json");
}

export async function seedContinuityArtifacts() {
  await ensureDir(getContinuityRoot());
  await writeFileIfMissing(
    getContinuityNotesPath(),
    "# Continuity Notes\n\nNo continuity notes captured yet.\n",
  );
  await writeFileIfMissing(
    getContinuityIndexPath(),
    `${JSON.stringify(
      {
        schemaVersion: "0.1.0",
        sessionCount: 0,
        lastUpdatedAt: null,
      },
      null,
      2,
    )}\n`,
  );
}

export async function loadContinuityNotes() {
  return fs.readFile(getContinuityNotesPath(), "utf8");
}

export async function loadContinuityIndex() {
  return readJson(getContinuityIndexPath());
}

export async function storeContinuityNote(content, options = {}) {
  const guard = await guardLeaderMutation({
    actor: options.actor,
    kind: "memory-note-write",
    payload: { content },
  });
  if (!guard.allowed) {
    return { proposed: true, proposalPath: guard.proposalPath };
  }

  const note = content.trim();
  if (!note) {
    throw new Error("memory.store_note requires non-empty content");
  }

  const [existingNotes, existingIndex] = await Promise.all([
    loadContinuityNotes(),
    loadContinuityIndex(),
  ]);
  const timestamp = new Date().toISOString();
  const nextNotes = `${existingNotes.trimEnd()}\n\n## ${timestamp}\n\n${note}\n`;
  const nextIndex = {
    ...existingIndex,
    sessionCount: existingIndex.sessionCount + 1,
    lastUpdatedAt: timestamp,
  };

  await Promise.all([
    fs.writeFile(getContinuityNotesPath(), nextNotes),
    writeJson(getContinuityIndexPath(), nextIndex),
  ]);

  return { proposed: false, proposalPath: null, index: nextIndex };
}
