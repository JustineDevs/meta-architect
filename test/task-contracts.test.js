import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import {
  createTaskContract,
  loadTaskContract,
  writeTaskContract,
} from "../src/runtime/task-contracts.js";
import { createTestNamespace } from "../src/test-fixtures.js";

test("task contracts persist intake context and stop conditions", async (t) => {
  const root = createTestNamespace("task-contract");
  const previousRoot = process.env.MA_ROOT;
  process.env.MA_ROOT = root;
  t.after(async () => {
    if (previousRoot === undefined) delete process.env.MA_ROOT;
    else process.env.MA_ROOT = previousRoot;
    await fs.rm(root, { recursive: true, force: true });
  });
  const contract = createTaskContract({
    goal: "Implement the bounded change",
    contextUsed: ["docs/architecture.md"],
    assumptions: ["The repository test command is authoritative"],
    constraints: ["Do not mutate release state"],
    risk: "low",
    verification: ["npm test"],
    stopCondition: "Focused and full tests pass",
  });
  await writeTaskContract("bounded-change", contract);
  const loaded = await loadTaskContract("bounded-change");
  assert.equal(loaded.record_type, "task_contract");
  assert.equal(loaded.stop_condition, "Focused and full tests pass");
  await assert.rejects(() => loadTaskContract("../escape"), /id is required/);
});

test("task contract supports no-persist intake for transient workflows", () => {
  const contract = createTaskContract({
    goal: "Run a bounded smoke check",
    stopCondition: "Smoke check completes",
    persist: false,
  });
  assert.equal(contract.persist, false);
  assert.deepEqual(contract.context_used, []);
});
