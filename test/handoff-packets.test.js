import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import {
  createHandoffPacket,
  loadHandoffPacket,
  writeHandoffPacket,
} from "../src/runtime/handoff-packets.js";
import { createTestNamespace } from "../src/test-fixtures.js";

test("handoff packets persist a compact, replayable contract", async (t) => {
  const root = createTestNamespace("handoff-packet");
  const previousRoot = process.env.MA_ROOT;
  process.env.MA_ROOT = root;
  t.after(async () => {
    if (previousRoot === undefined) delete process.env.MA_ROOT;
    else process.env.MA_ROOT = previousRoot;
    await fs.rm(root, { recursive: true, force: true });
  });

  const packet = createHandoffPacket({
    goal: "Verify the release gate",
    currentState: "Implementation complete",
    contextUsed: [".ma/context/project-index.json"],
    decisions: ["Keep release authority with the owning lane"],
    changedFiles: ["src/runtime/handoff-packets.js"],
    verification: ["npm test"],
    nextAction: "Run release verification",
  });
  await writeHandoffPacket("release-review", packet);
  const loaded = await loadHandoffPacket("release-review");
  assert.equal(loaded.record_type, "handoff_packet");
  assert.deepEqual(loaded.verification, ["npm test"]);
  await assert.rejects(() => loadHandoffPacket("../escape"), /id is required/);
});

test("handoff packets preserve blocked and verifier states", () => {
  for (const status of ["blocked", "verified"]) {
    const packet = createHandoffPacket({
      goal: "Review a bounded change",
      currentState: status === "blocked" ? "Waiting on evidence" : "Evidence complete",
      blockers: status === "blocked" ? ["Missing test receipt"] : [],
      verification: ["npm test"],
      nextAction: status === "blocked" ? "Collect receipt" : "Prepare merge review",
      status,
    });
    assert.equal(packet.status, status);
    assert.ok(packet.verification.length > 0);
  }
});
