import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createDefaultHeadroomBudgets,
  evaluateHeadroom,
  getHeadroomBudgetsPath,
  getHeadroomStatusPath,
  loadHeadroomBudgets,
  loadHeadroomStatus,
  seedHeadroomArtifacts,
  writeHeadroomStatus,
} from "../src/runtime/headroom-core.js";

test("headroom seeds inspectable budgets and derived status", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ma-headroom-"));
  const previousRoot = process.env.MA_ROOT;
  process.env.MA_ROOT = root;

  try {
    await seedHeadroomArtifacts();
    assert.deepEqual((await loadHeadroomBudgets()).budgets, createDefaultHeadroomBudgets().budgets);
    assert.deepEqual((await loadHeadroomStatus()).signals, []);
    await writeHeadroomStatus({
      pendingMailboxCount: 8,
      taskCount: 3,
      activeManagerRunCount: 2,
      waitingReviewManagerRunCount: 0,
    });
    assert.equal((await loadHeadroomStatus()).signals[0].level, "critical");
    assert.equal(await fs.access(getHeadroomBudgetsPath()).then(() => true), true);
    assert.equal(await fs.access(getHeadroomStatusPath()).then(() => true), true);
  } finally {
    if (previousRoot === undefined) delete process.env.MA_ROOT;
    else process.env.MA_ROOT = previousRoot;
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("headroom classifies each configured counter at ok, warn, and critical", () => {
  const config = {
    schemaVersion: "0.1.0",
    budgets: {
      pendingMailboxCount: { warn: 3, critical: 8 },
      taskCount: { warn: 10, critical: 25 },
      activeManagerRunCount: { warn: 2, critical: 5 },
      waitingReviewManagerRunCount: { warn: 1, critical: 3 },
    },
  };
  const status = evaluateHeadroom(
    {
      pendingMailboxCount: 3,
      taskCount: 25,
      activeManagerRunCount: 1,
      waitingReviewManagerRunCount: 3,
    },
    config,
  );
  assert.deepEqual(
    Object.fromEntries(status.signals.map((signal) => [signal.counter, signal.level])),
    {
      pendingMailboxCount: "warn",
      taskCount: "critical",
      activeManagerRunCount: "ok",
      waitingReviewManagerRunCount: "critical",
    },
  );
});

test("headroom rejects malformed or inverted budgets", () => {
  assert.throws(
    () =>
      evaluateHeadroom(
        {},
        { schemaVersion: "0.1.0", budgets: { taskCount: { warn: 5, critical: 2 } } },
      ),
    /Invalid headroom budget/,
  );
  assert.throws(() => evaluateHeadroom({}, { schemaVersion: "0.1.0" }), /budgets object/);
});
