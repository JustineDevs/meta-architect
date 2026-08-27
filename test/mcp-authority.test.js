import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { createTempRepo } from "./helpers/temp-repo.js";

const repoRoot = process.cwd();

async function withTempRepo(run) {
  const root = await createTempRepo("mcp-authority-", repoRoot);
  const previousRoot = process.env.MA_ROOT;
  process.env.MA_ROOT = root;
  try {
    return await run(root);
  } finally {
    if (previousRoot === undefined) delete process.env.MA_ROOT;
    else process.env.MA_ROOT = previousRoot;
    await fs.rm(root, { recursive: true, force: true });
  }
}

test("MCP writes require metadata, audit every outcome, and honor read-only profiles", async () => {
  await withTempRepo(async (root) => {
    const stamp = Date.now();
    const skills = await import(
      `${pathToFileURL(path.join(repoRoot, "src", "skills.js")).href}?t=${stamp}`
    );
    const state = await import(
      `${pathToFileURL(path.join(repoRoot, "mcp/local/state.js")).href}?t=${stamp}`
    );
    const authority = await import(
      `${pathToFileURL(path.join(repoRoot, "src/runtime/mcp-authority.js")).href}?t=${stamp}`
    );
    await skills.runInit();

    const proposed = await state.callStateTool("state.sync_release_status", {
      idea_status: "CLEAR",
    });
    assert.equal(proposed.proposed, true);
    assert.equal(proposed.reason, "missing_authority");

    const allowed = await state.callStateTool(
      "state.sync_release_status",
      { idea_status: "CLEAR" },
      {
        actor: "leader",
        authority: "$maestro_or_owning_lane",
        reason: "verified MCP authority gate",
        evidence: ["test/mcp-authority.test.js"],
      },
    );
    assert.equal(allowed.proposed, false);
    assert.match(allowed.auditReceipt, /mcp[\\/]receipts/);

    const denied = await state.callStateTool(
      "state.sync_release_status",
      { idea_status: "DRAFT" },
      {
        profile: "audit",
        actor: "leader",
        authority: "$maestro_or_owning_lane",
        reason: "audit must not mutate",
        evidence: "read-only profile test",
      },
    );
    assert.equal(denied.denied, true);
    assert.equal(denied.reason, "profile_read_only");

    const receipts = await authority.loadMcpAuditReceipts();
    assert.equal(receipts.length, 3);
    assert.deepEqual(receipts.map((receipt) => receipt.outcome).sort(), [
      "allowed",
      "denied",
      "proposed",
    ]);
    assert.equal(
      receipts.every((receipt) => receipt.record_type === "mcp_write_audit_receipt"),
      true,
    );
    assert.equal(authority.mcpWriteCapabilityStatus().tools.length, 5);
    assert.equal(await fs.access(path.join(root, ".ma", "mcp", "receipts")), undefined);
  });
});
