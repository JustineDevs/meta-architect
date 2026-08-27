import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createDefaultGraphifyIndex,
  getGraphifyIndexPath,
  loadGraphifyIndex,
  rebuildGraphifyIndex,
  seedGraphifyArtifacts,
  writeGraphifyIndex,
} from "../src/runtime/graphify-core.js";

test("graphify seeds a read-only derived index and rebuilds subsystem relationships", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ma-graphify-"));
  const previousRoot = process.env.MA_ROOT;
  process.env.MA_ROOT = root;

  try {
    await seedGraphifyArtifacts();
    assert.deepEqual(await loadGraphifyIndex(), createDefaultGraphifyIndex());

    const index = await writeGraphifyIndex({
      continuityIndex: { sessionCount: 1 },
      taskRegistry: {
        tasks: [{ id: "task-1", title: "Build graph" }],
        workers: [{ id: "worker-1", name: "executor" }],
      },
      mailboxEntries: ["proposal.json"],
      workspaceIndex: { items: [{ id: "workspace-1", name: "main" }] },
      managerRuns: { runs: [{ id: "run-1", state: "active" }] },
      decisions: { decisions: [{ id: "decision-1", title: "Keep graph derived" }] },
      obsidianVaultIndex: { note_count: 1, vault_path: "/vault" },
    });

    assert.equal(index.read_only, true);
    assert.equal(index.nodes.length, 9);
    assert.equal(index.edges.length, 3);
    assert.equal((await loadGraphifyIndex()).lastRebuiltAt, index.lastRebuiltAt);
    assert.equal(await fs.access(getGraphifyIndexPath()).then(() => true), true);

    const runtimeState = await import("../src/runtime/runtime-state.js");
    await runtimeState.ensureRuntimeSubsystems();
    const summary = runtimeState.createRuntimeSummary(await runtimeState.loadRuntimeSnapshot());
    assert.equal(summary.graphNodeCount, 9);
    assert.equal(summary.graphEdgeCount, 3);
    assert.equal(summary.graphLastRebuiltAt, index.lastRebuiltAt);
  } finally {
    if (previousRoot === undefined) delete process.env.MA_ROOT;
    else process.env.MA_ROOT = previousRoot;
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("graphify rebuild is deterministic apart from rebuild timestamp", () => {
  const snapshot = {
    continuityIndex: { sessionCount: 1 },
    taskRegistry: { tasks: [{ id: "b", title: "B" }], workers: [{ id: "a", name: "A" }] },
    mailboxEntries: ["z.json", "a.json"],
  };
  const first = rebuildGraphifyIndex(snapshot);
  const second = rebuildGraphifyIndex(snapshot);
  assert.deepEqual({ ...first, lastRebuiltAt: null }, { ...second, lastRebuiltAt: null });
});
