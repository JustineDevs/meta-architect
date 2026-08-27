import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  getCodeburnLogPath,
  loadCodeburnUsage,
  seedCodeburnArtifacts,
  syncCodeburnUsage,
} from "../src/runtime/codeburn-core.js";

test("codeburn seeds and syncs normalized CLI usage without changing release state", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ma-codeburn-"));
  const previousRoot = process.env.MA_ROOT;
  process.env.MA_ROOT = root;

  try {
    await seedCodeburnArtifacts();
    const result = await syncCodeburnUsage({
      command: "mock-codeburn",
      args: [],
      exec: async () => ({
        stdout: JSON.stringify({
          entries: [
            { provider: "openai", model: "gpt-test", inputTokens: 10, outputTokens: 5, cost: 0.02 },
            { provider: "anthropic", tokens: 7, totalCost: 0.03 },
          ],
        }),
      }),
    });
    assert.equal(result.available, true);
    assert.equal(result.usage.totalTokens, 22);
    assert.equal(result.usage.totalCost, 0.05);
    assert.equal((await loadCodeburnUsage()).entries.length, 2);
    assert.equal(await fs.access(getCodeburnLogPath()).then(() => true), true);
    const runtimeState = await import("../src/runtime/runtime-state.js");
    const summary = runtimeState.createRuntimeSummary(await runtimeState.loadRuntimeSnapshot());
    assert.equal(summary.tokenUsage, 22);
    assert.equal(summary.estimatedCost, 0.05);
  } finally {
    if (previousRoot === undefined) delete process.env.MA_ROOT;
    else process.env.MA_ROOT = previousRoot;
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("codeburn missing CLI is a graceful no-op", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ma-codeburn-missing-"));
  const previousRoot = process.env.MA_ROOT;
  process.env.MA_ROOT = root;

  try {
    await seedCodeburnArtifacts();
    const result = await syncCodeburnUsage({
      command: "missing-codeburn",
      args: [],
      exec: async () => {
        throw new Error("ENOENT");
      },
    });
    assert.equal(result.available, false);
    assert.equal(result.usage.totalTokens, 0);
    assert.equal((await loadCodeburnUsage()).totalCost, 0);
  } finally {
    if (previousRoot === undefined) delete process.env.MA_ROOT;
    else process.env.MA_ROOT = previousRoot;
    await fs.rm(root, { recursive: true, force: true });
  }
});
