import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { queryMemoryGraph, readMemoryResource } from "../mcp/local/memory.js";
import {
  loadContinuityGraph,
  queryContinuityGraph,
  validateContinuityGraph,
} from "../src/runtime/continuity-graph.js";
import {
  knowledgeScopes,
  loadScopedKnowledge,
  seedContinuityArtifacts,
  storeContinuityNote,
} from "../src/runtime/continuity-notes.js";
import { createTestNamespace } from "../src/test-fixtures.js";

test("knowledge scopes keep personal and session notes out of shared memory by default", async (t) => {
  const root = createTestNamespace("ma-knowledge-scopes");
  const previousRoot = process.env.MA_ROOT;
  process.env.MA_ROOT = root;
  t.after(async () => {
    if (previousRoot === undefined) delete process.env.MA_ROOT;
    else process.env.MA_ROOT = previousRoot;
    await fs.rm(root, { recursive: true, force: true });
  });

  await seedContinuityArtifacts();
  for (const scope of knowledgeScopes) {
    await storeContinuityNote(`${scope} note`, { scope, actor: "leader" });
  }
  const shared = await loadScopedKnowledge();
  assert.match(shared, /project-shared note/);
  assert.match(shared, /team\/process note/);
  assert.doesNotMatch(shared, /personal\/local note|session-only note/);
  assert.match(
    await fs.readFile(path.join(root, ".ma", "memory", "personal.md"), "utf8"),
    /personal\/local note/,
  );
});

test("continuity notes incrementally update a validated graph and expose traversal through MCP", async (t) => {
  const root = createTestNamespace("ma-knowledge-graph");
  const previousRoot = process.env.MA_ROOT;
  process.env.MA_ROOT = root;
  t.after(async () => {
    if (previousRoot === undefined) delete process.env.MA_ROOT;
    else process.env.MA_ROOT = previousRoot;
    await fs.rm(root, { recursive: true, force: true });
  });

  await seedContinuityArtifacts();
  const result = await storeContinuityNote("Architecture depends on Graphify and Obsidian", {
    scope: "project-shared",
    entities: ["Architecture", "Graphify", "Obsidian"],
    actor: "leader",
  });
  assert.equal(result.proposed, false);
  const graph = await loadContinuityGraph();
  assert.equal(graph.record_type, "continuity_knowledge_graph");
  assert.ok(graph.nodes.some((node) => node.label === "graphify"));
  assert.ok(graph.edges.some((edge) => edge.relation === "co_occurs"));
  assert.deepEqual(await readMemoryResource("memory://graph"), graph);
  const query = await queryMemoryGraph({ label: "graphify", depth: 1 });
  assert.ok(query.nodes.some((node) => node.label === "obsidian"));
});

test("continuity graph rejects malformed MCP state and serializes concurrent writes", async (t) => {
  const root = createTestNamespace("ma-knowledge-graph-integrity");
  const previousRoot = process.env.MA_ROOT;
  process.env.MA_ROOT = root;
  t.after(async () => {
    if (previousRoot === undefined) delete process.env.MA_ROOT;
    else process.env.MA_ROOT = previousRoot;
    await fs.rm(root, { recursive: true, force: true });
  });

  await seedContinuityArtifacts();
  const graph = await loadContinuityGraph();
  assert.throws(
    () => validateContinuityGraph({ ...graph, nodes: [{ ...graph.nodes, label: 42 }] }),
    /invalid node/,
  );
  await Promise.all(
    Array.from({ length: 20 }, (_, index) =>
      storeContinuityNote(`concurrent note ${index}`, { actor: "leader" }),
    ),
  );
  const index = JSON.parse(await fs.readFile(path.join(root, ".ma", "memory", "index.json")));
  const notes = await fs.readFile(path.join(root, ".ma", "memory", "notes.md"), "utf8");
  const nextGraph = await loadContinuityGraph();
  assert.equal(index.sessionCount, 20);
  assert.equal((notes.match(/## /g) ?? []).length, 20);
  assert.equal(nextGraph.nodes.filter((node) => node.type === "session").length, 20);
  assert.throws(() => queryContinuityGraph({ ...graph, nodes: [{ id: "x" }] }, { nodeId: "x" }));
});
