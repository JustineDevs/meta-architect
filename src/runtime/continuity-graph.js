import { createHash } from "node:crypto";
import { ensureDir, readJson, writeFileIfMissing, writeJson } from "../fs-utils.js";
import { getRuntimeSubsystemPath } from "../paths.js";

export const continuityGraphSchemaVersion = "0.1.0";

export function getContinuityGraphPath() {
  return getRuntimeSubsystemPath("memory", "graph.json");
}

export function createDefaultContinuityGraph() {
  return {
    schemaVersion: continuityGraphSchemaVersion,
    record_type: "continuity_knowledge_graph",
    humanReadableMirror: ".ma/memory/notes.md",
    nodes: [],
    edges: [],
    lastUpdatedAt: null,
  };
}

export function validateContinuityGraph(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("continuity graph must be an object");
  }
  if (value.schemaVersion !== continuityGraphSchemaVersion) {
    throw new Error(`Unsupported continuity graph schemaVersion: ${value.schemaVersion}`);
  }
  if (value.record_type !== "continuity_knowledge_graph") {
    throw new Error("continuity graph has an invalid record_type");
  }
  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) {
    throw new Error("continuity graph requires nodes and edges arrays");
  }
  for (const node of value.nodes) {
    if (
      !node ||
      typeof node !== "object" ||
      typeof node.id !== "string" ||
      typeof node.type !== "string" ||
      typeof node.label !== "string" ||
      typeof node.scope !== "string" ||
      !Number.isInteger(node.mentions) ||
      node.mentions < 0
    ) {
      throw new Error("continuity graph contains an invalid node");
    }
  }
  const nodeIds = new Set(value.nodes.map((node) => node.id));
  for (const edge of value.edges) {
    if (
      !edge ||
      typeof edge !== "object" ||
      typeof edge.id !== "string" ||
      typeof edge.source !== "string" ||
      typeof edge.target !== "string" ||
      typeof edge.relation !== "string" ||
      !nodeIds.has(edge.source) ||
      !nodeIds.has(edge.target)
    ) {
      throw new Error("continuity graph contains an invalid edge");
    }
  }
  return value;
}

export async function seedContinuityGraphArtifacts() {
  await ensureDir(getRuntimeSubsystemPath("memory"));
  await writeFileIfMissing(
    getContinuityGraphPath(),
    `${JSON.stringify(createDefaultContinuityGraph(), null, 2)}\n`,
  );
}

export async function loadContinuityGraph() {
  return validateContinuityGraph(await readJson(getContinuityGraphPath()));
}

function stableId(prefix, value) {
  return `${prefix}:${createHash("sha256").update(value).digest("hex").slice(0, 16)}`;
}

function deriveEntities(content, explicit = []) {
  const values = [
    ...explicit,
    ...(content.match(/`([^`]+)`|#([a-z][\w-]*)|\b[A-Z][A-Za-z0-9_-]{2,}\b/g) ?? []),
  ]
    .map((value) => value.replaceAll("`", "").replace(/^#/, "").trim().toLowerCase())
    .filter((value) => value.length >= 3 && value.length <= 80);
  return [...new Set(values)].slice(0, 32);
}

export function mergeContinuityGraph(
  graph,
  { content, scope, timestamp, entities = [], relationships = [] },
) {
  const next = validateContinuityGraph(graph);
  const noteId = stableId("note", `${timestamp}\0${scope}\0${content}`);
  const entityNames = deriveEntities(content, entities);
  const nodes = [...next.nodes];
  const edges = [...next.edges];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edgeKeys = new Set(edges.map((edge) => `${edge.source}\0${edge.target}\0${edge.relation}`));
  const addNode = (node) => {
    const existing = nodeById.get(node.id);
    if (existing) {
      existing.updatedAt = timestamp;
      existing.mentions = (existing.mentions ?? 0) + (node.mentions ?? 0);
      return;
    }
    nodeById.set(node.id, node);
    nodes.push(node);
  };
  const addEdge = (source, target, relation) => {
    const key = `${source}\0${target}\0${relation}`;
    if (source === target || edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ id: stableId("edge", key), source, target, relation, updatedAt: timestamp });
  };

  addNode({
    id: noteId,
    type: "session",
    label: `${scope} note`,
    scope,
    mentions: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  const entityIds = entityNames.map((name) => {
    const id = stableId("entity", name);
    addNode({
      id,
      type: "entity",
      label: name,
      scope,
      mentions: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    addEdge(noteId, id, "mentions");
    return id;
  });
  for (let index = 0; index < entityIds.length; index += 1) {
    for (let other = index + 1; other < entityIds.length; other += 1)
      addEdge(entityIds[index], entityIds[other], "co_occurs");
  }
  for (const relationship of relationships) {
    if (!relationship || typeof relationship !== "object") continue;
    const from = stableId("entity", String(relationship.from ?? "").toLowerCase());
    const to = stableId("entity", String(relationship.to ?? "").toLowerCase());
    if (nodeById.has(from) && nodeById.has(to) && relationship.relation)
      addEdge(from, to, String(relationship.relation));
  }
  return {
    ...next,
    nodes: nodes.slice(-1000),
    edges: edges.slice(-4000),
    lastUpdatedAt: timestamp,
  };
}

export function queryContinuityGraph(graph, { nodeId, label, depth = 2, limit = 100 } = {}) {
  const value = validateContinuityGraph(graph);
  const normalizedLabel = label?.trim().toLowerCase();
  const boundedLimit = Math.max(1, Math.min(Number(limit) || 100, 1000));
  const starts = value.nodes.filter(
    (node) =>
      node.id === nodeId || (normalizedLabel && node.label.toLowerCase() === normalizedLabel),
  );
  if (starts.length === 0) return { nodes: [], edges: [], depth: 0 };
  const included = new Set(starts.map((node) => node.id));
  let frontier = [...included];
  const maxDepth = Math.max(0, Math.min(Number(depth) || 0, 5));
  for (let level = 0; level < maxDepth; level += 1) {
    const next = [];
    for (const edge of value.edges) {
      if (frontier.includes(edge.source) && !included.has(edge.target)) next.push(edge.target);
      if (frontier.includes(edge.target) && !included.has(edge.source)) next.push(edge.source);
    }
    frontier = [...new Set(next)].slice(0, boundedLimit);
    frontier.forEach((id) => {
      included.add(id);
    });
    if (frontier.length === 0) break;
  }
  const nodes = value.nodes.filter((node) => included.has(node.id)).slice(0, boundedLimit);
  const ids = new Set(nodes.map((node) => node.id));
  return {
    nodes,
    edges: value.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
    depth: maxDepth,
  };
}

export async function mergeContinuityGraphEntry(entry) {
  const graph = await loadContinuityGraph();
  const next = mergeContinuityGraph(graph, entry);
  await writeJson(getContinuityGraphPath(), next);
  return next;
}
