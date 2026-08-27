import { ensureDir, readJson, writeFileIfMissing, writeJson } from "../fs-utils.js";
import { getRuntimeSubsystemPath } from "../paths.js";

export const graphifySchemaVersion = "0.1.0";

export function getGraphifyRoot() {
  return getRuntimeSubsystemPath("context", "graphify");
}

export function getGraphifyIndexPath() {
  return getRuntimeSubsystemPath("context", "graphify", "index.json");
}

export function createDefaultGraphifyIndex() {
  return {
    schemaVersion: graphifySchemaVersion,
    record_type: "derived_graph_index",
    read_only: true,
    nodes: [],
    edges: [],
    lastRebuiltAt: null,
  };
}

export function validateGraphifyIndex(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("graphify index must be an object");
  }
  if (value.schemaVersion !== graphifySchemaVersion) {
    throw new Error(`Unsupported graphify schemaVersion: ${value.schemaVersion}`);
  }
  if (value.record_type !== "derived_graph_index" || value.read_only !== true) {
    throw new Error("graphify index must be a read-only derived_graph_index");
  }
  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) {
    throw new Error("graphify index requires nodes and edges arrays");
  }
  return value;
}

export async function seedGraphifyArtifacts() {
  await ensureDir(getGraphifyRoot());
  await writeFileIfMissing(
    getGraphifyIndexPath(),
    `${JSON.stringify(createDefaultGraphifyIndex(), null, 2)}\n`,
  );
}

export async function loadGraphifyIndex() {
  return validateGraphifyIndex(await readJson(getGraphifyIndexPath()));
}

function addNode(nodes, seen, id, kind, sourceSubsystem, label) {
  if (!id || seen.has(id)) return;
  seen.add(id);
  nodes.push({ id, kind, sourceSubsystem, label: String(label ?? id) });
}

function addEdge(edges, seen, from, to, relation) {
  if (!from || !to || from === to) return;
  const key = `${from}\0${to}\0${relation}`;
  if (seen.has(key)) return;
  seen.add(key);
  edges.push({ from, to, relation });
}

function addCollection(nodes, edges, nodeIds, edgeIds, sourceSubsystem, kind, entries, labelKey) {
  for (const [index, entry] of (Array.isArray(entries) ? entries : []).entries()) {
    if (!entry || typeof entry !== "object") continue;
    const id = `${sourceSubsystem}:${kind}:${entry.id ?? entry.name ?? index}`;
    addNode(
      nodes,
      nodeIds,
      id,
      kind,
      sourceSubsystem,
      entry[labelKey] ?? entry.name ?? entry.id ?? id,
    );
    if (entry.projectId) addEdge(edges, edgeIds, id, `project:${entry.projectId}`, "belongs_to");
  }
}

export function rebuildGraphifyIndex(runtimeSnapshot = {}) {
  const nodes = [];
  const edges = [];
  const nodeIds = new Set();
  const edgeIds = new Set();
  addNode(nodes, nodeIds, "project:root", "project", "project", "Project");

  const continuity = runtimeSnapshot.continuityIndex;
  if (continuity && typeof continuity === "object") {
    addNode(nodes, nodeIds, "memory:continuity", "memory", "continuity", "Continuity memory");
    addEdge(edges, edgeIds, "memory:continuity", "project:root", "supports");
  }
  const taskRegistry = runtimeSnapshot.taskRegistry ?? {};
  addCollection(nodes, edges, nodeIds, edgeIds, "tasks", "task", taskRegistry.tasks, "title");
  addCollection(nodes, edges, nodeIds, edgeIds, "tasks", "worker", taskRegistry.workers, "name");
  for (const entry of runtimeSnapshot.mailboxEntries ?? []) {
    if (typeof entry !== "string") continue;
    const id = `tasks:mailbox:${entry}`;
    addNode(nodes, nodeIds, id, "mailbox", "tasks", entry, entry);
    addEdge(edges, edgeIds, id, "project:root", "supports");
  }
  addCollection(
    nodes,
    edges,
    nodeIds,
    edgeIds,
    "workspaces",
    "workspace",
    runtimeSnapshot.workspaceIndex?.items,
    "name",
  );
  addCollection(
    nodes,
    edges,
    nodeIds,
    edgeIds,
    "manager",
    "run",
    runtimeSnapshot.managerRuns?.runs,
    "state",
  );
  addCollection(
    nodes,
    edges,
    nodeIds,
    edgeIds,
    "decisions",
    "decision",
    runtimeSnapshot.decisions?.decisions,
    "title",
  );

  const vault = runtimeSnapshot.obsidianVaultIndex;
  if (vault?.note_count > 0) {
    addNode(
      nodes,
      nodeIds,
      "obsidian:vault",
      "vault",
      "obsidian",
      vault.vault_path || "Obsidian vault",
    );
    addEdge(edges, edgeIds, "obsidian:vault", "project:root", "context");
  }

  nodes.sort((a, b) => a.id.localeCompare(b.id));
  edges.sort((a, b) =>
    `${a.from}:${a.to}:${a.relation}`.localeCompare(`${b.from}:${b.to}:${b.relation}`),
  );
  return {
    schemaVersion: graphifySchemaVersion,
    record_type: "derived_graph_index",
    read_only: true,
    nodes,
    edges,
    lastRebuiltAt: new Date().toISOString(),
  };
}

export async function writeGraphifyIndex(runtimeSnapshot) {
  const index = validateGraphifyIndex(rebuildGraphifyIndex(runtimeSnapshot));
  await ensureDir(getGraphifyRoot());
  await writeJson(getGraphifyIndexPath(), index);
  return index;
}
