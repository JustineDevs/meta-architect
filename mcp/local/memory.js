import { loadContinuityGraph, queryContinuityGraph } from "../../src/runtime/continuity-graph.js";
import {
  loadContinuityIndex,
  loadContinuityNotes,
  storeContinuityNote,
} from "../../src/runtime/continuity-notes.js";
import { withMcpWriteGate } from "../../src/runtime/mcp-authority.js";

const memoryResources = ["memory://notes", "memory://index", "memory://graph"];
const memoryTools = ["memory.store_note", "memory.query_graph"];

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
  if (uri === "memory://graph") {
    return loadContinuityGraph();
  }

  throw new Error(`Unknown memory resource: ${uri}`);
}

export async function callMemoryTool(name, args = {}, options = {}) {
  if (name === "memory.query_graph") {
    return queryMemoryGraph(args);
  }
  if (name !== "memory.store_note") {
    throw new Error(`Unknown memory tool: ${name}`);
  }

  return withMcpWriteGate({ tool: name, options, payload: args }, (metadata) =>
    storeContinuityNote(args.content ?? "", { ...options, ...metadata }),
  );
}

export async function queryMemoryGraph(args = {}) {
  return queryContinuityGraph(await loadContinuityGraph(), args);
}

export async function checkMemoryCapability() {
  const index = await readMemoryResource("memory://index");
  return {
    ready: typeof index.sessionCount === "number",
    detail: `continuity index loaded with sessionCount=${index.sessionCount}`,
  };
}
