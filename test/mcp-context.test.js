import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { readContextResource } from "../mcp/local/context.js";
import { createTestNamespace } from "../src/test-fixtures.js";

test("context MCP exposes source and freshness metadata without write tools", async () => {
  const root = createTestNamespace("mcp-context");
  const previousRoot = process.env.MA_ROOT;
  process.env.MA_ROOT = root;
  try {
    await fs.mkdir(path.join(root, ".ma", "context"), { recursive: true });
    await fs.writeFile(
      path.join(root, ".ma", "context", "project-index.json"),
      JSON.stringify({
        schemaVersion: "0.1.0",
        record_type: "project_index",
        authority: "source_truth",
        source: "repository-filesystem",
        sourceFiles: [],
        freshness: {
          status: "fresh",
          sourceHash: "test-source-hash",
          checkedAt: "2026-08-24T00:00:00.000Z",
          changedFiles: [],
        },
        quality: {
          completeness: "complete",
          confidence: "verified",
          coverage: { sourceFiles: 0 },
        },
        facts: [{ id: "fact-0123456789abcdef", authority: "source_truth" }],
      }),
    );
    await fs.writeFile(
      path.join(root, ".ma", "context", "commands.json"),
      JSON.stringify({ schemaVersion: "0.1.0", commands: { test: "npm test" } }),
    );
    await fs.writeFile(path.join(root, ".ma", "context", "agent-brief.md"), "# Brief\n");
    await fs.mkdir(path.join(root, ".ma", "learning"), { recursive: true });
    await fs.writeFile(
      path.join(root, ".ma", "learning", "records.jsonl"),
      `${JSON.stringify({ claim: "Failure: command failed", failure_state: "active", fact_ids: [] })}\n`,
    );

    const project = await readContextResource("context://project-index");
    const freshness = await readContextResource("context://freshness");
    assert.equal(project.available, true);
    assert.equal(project.authority, "source_truth");
    assert.equal(project.quality.confidence, "verified");
    assert.equal(project.context.authority, "source_truth");
    assert.equal(project.context.freshness.status, "fresh");
    assert.deepEqual(project.fact_ids, ["fact-0123456789abcdef"]);
    assert.equal(freshness.data.status, "fresh");
    const commands = await readContextResource("context://commands");
    const brief = await readContextResource("context://agent-brief");
    const learning = await readContextResource("context://learning");
    assert.deepEqual(commands.data.commands, { test: "npm test" });
    assert.match(brief.data, /Brief/);
    assert.equal(learning.data.failure_records.length, 1);
    assert.equal((await readContextResource("context://hooks")).authority, "hook_evidence");
    await assert.rejects(() => readContextResource("context://write"), /Unknown context resource/);
  } finally {
    if (previousRoot === undefined) delete process.env.MA_ROOT;
    else process.env.MA_ROOT = previousRoot;
    await fs.rm(root, { recursive: true, force: true });
  }
});
