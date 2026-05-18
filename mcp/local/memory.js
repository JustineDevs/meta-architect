import {
  loadContinuityIndex,
  loadContinuityNotes,
  storeContinuityNote,
} from "../../src/runtime/continuity-notes.js";

const memoryResources = ["memory://notes", "memory://index"];
const memoryTools = ["memory.store_note"];

export function listMemoryResources() {
  return [...memoryResources];
}

export function listMemoryTools() {
  return [...memoryTools];
}

export async function readMemoryResource(uri) {
  if (uri === "memory://notes") {
    return loadContinuityNotes();
  }
  if (uri === "memory://index") {
    return loadContinuityIndex();
  }

  throw new Error(`Unknown memory resource: ${uri}`);
}

export async function callMemoryTool(name, args = {}, options = {}) {
  if (name !== "memory.store_note") {
    throw new Error(`Unknown memory tool: ${name}`);
  }

  return storeContinuityNote(args.content ?? "", {
    ...options,
    actor: "local-capability:memory",
  });
}

export async function checkMemoryCapability() {
  const index = await readMemoryResource("memory://index");
  return {
    ready: typeof index.sessionCount === "number",
    detail: `continuity index loaded with sessionCount=${index.sessionCount}`,
  };
}
