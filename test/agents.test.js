import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  detectInstalled,
  getAgent,
  getNonUniversalAgents,
  isUniversalAgent,
  resolveAgentCommand,
} from "../src/agents.js";

test("agent registry exposes shared universal and vendor surfaces", () => {
  assert.equal(getAgent().id, "codex");
  assert.equal(isUniversalAgent("codex"), true);
  assert.equal(isUniversalAgent("claude-code"), false);
  assert.deepEqual(
    getNonUniversalAgents().map((agent) => agent.id),
    ["claude-code", "cursor"],
  );
});

test("agent command resolution and installed detection honor selected surface", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ma-agent-"));
  const command = path.join(root, "fake-agent.mjs");
  await fs.writeFile(command, 'process.stdout.write("fake-agent 1.0.0\\n");\n');
  try {
    process.env.MA_CURSOR_BIN = command;
    assert.equal(resolveAgentCommand("cursor"), command);
    const result = detectInstalled("cursor");
    assert.equal(result.installed, true);
    assert.equal(result.version, "fake-agent 1.0.0");
  } finally {
    delete process.env.MA_CURSOR_BIN;
    await fs.rm(root, { recursive: true, force: true });
  }
});
