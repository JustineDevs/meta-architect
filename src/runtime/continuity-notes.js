import fs from "node:fs/promises";
import path from "node:path";
import {
  ensureDir,
  readJson,
  writeFileIfMissing,
  writeJson,
  writeTextAtomically,
} from "../fs-utils.js";
import { getRuntimeSubsystemPath } from "../paths.js";
import { mergeContinuityGraphEntry, seedContinuityGraphArtifacts } from "./continuity-graph.js";
import { guardLeaderMutation } from "./runtime-state.js";

export const knowledgeScopes = ["personal/local", "project-shared", "team/process", "session-only"];
let continuityWriteQueue = Promise.resolve();
const scopeFiles = {
  "personal/local": "personal.md",
  "project-shared": "notes.md",
  "team/process": "team.md",
  "session-only": "session.md",
};

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
  await seedContinuityGraphArtifacts();
  for (const file of ["personal.md", "team.md", "session.md"]) {
    await writeFileIfMissing(
      path.join(getContinuityRoot(), file),
      `# ${file.replace(".md", "")} knowledge\n\nNo notes captured yet.\n`,
    );
  }
  await writeFileIfMissing(
    getContinuityIndexPath(),
    `${JSON.stringify(
      {
        schemaVersion: "0.1.0",
        sessionCount: 0,
        lastUpdatedAt: null,
        knowledgeScopes,
      },
      null,
      2,
    )}\n`,
  );
}

export async function loadContinuityNotes() {
  return loadScopedKnowledge({ scopes: ["project-shared", "team/process"] });
}

export async function loadScopedKnowledge({ scopes = ["project-shared", "team/process"] } = {}) {
  const selected = scopes.filter((scope) => knowledgeScopes.includes(scope));
  const notes = await Promise.all(
    selected.map((scope) =>
      fs.readFile(path.join(getContinuityRoot(), scopeFiles[scope]), "utf8").catch(() => ""),
    ),
  );
  return notes.filter(Boolean).join("\n\n");
}

export async function loadContinuityIndex() {
  return readJson(getContinuityIndexPath());
}

export async function storeContinuityNote(content, options = {}) {
  const guard = await guardLeaderMutation({
    actor: options.actor,
    kind: "memory-note-write",
    payload: { content, scope: options.scope ?? "session-only" },
  });
  if (!guard.allowed) {
    return { proposed: true, proposalPath: guard.proposalPath };
  }

  const operation = continuityWriteQueue.then(async () => {
    const note = content.trim();
    if (!note) throw new Error("memory.store_note requires non-empty content");
    const scope = options.scope ?? "project-shared";
    if (!knowledgeScopes.includes(scope)) throw new Error(`Unsupported knowledge scope: ${scope}`);
    const [existingNotes, existingIndex] = await Promise.all([
      fs.readFile(path.join(getContinuityRoot(), scopeFiles[scope]), "utf8").catch(() => ""),
      loadContinuityIndex(),
    ]);
    const timestamp = new Date().toISOString();
    const nextNotes = `${existingNotes.trimEnd()}\n\n## ${timestamp}\n\n${note}\n`;
    const nextIndex = {
      ...existingIndex,
      sessionCount: existingIndex.sessionCount + 1,
      lastUpdatedAt: timestamp,
      scopeCounts: {
        ...(existingIndex.scopeCounts ?? {}),
        [scope]: (existingIndex.scopeCounts?.[scope] ?? 0) + 1,
      },
    };
    await writeTextAtomically(path.join(getContinuityRoot(), scopeFiles[scope]), nextNotes);
    await writeJson(getContinuityIndexPath(), nextIndex);
    await mergeContinuityGraphEntry({
      content: note,
      scope,
      timestamp,
      entities: options.entities,
      relationships: options.relationships,
    });
    return { proposed: false, proposalPath: null, index: nextIndex };
  });
  continuityWriteQueue = operation.catch(() => {});
  return operation;
}
