import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  addLearningRecord,
  appendLearningRecord,
  createDefaultLearningLoopCore,
  createLearningRecord,
  evaluateLearningLoopReadiness,
  learningLoopDomains,
  loadLearningLoopCore,
  loadLearningRecords,
  recordFailureMemory,
  recordWorkLearning,
  validateLearningLoopCore,
} from "../src/runtime/learning-loop-core.js";
import { runInit } from "../src/skills.js";
import { createTestNamespace } from "../src/test-fixtures.js";

test("Learning Loop Core covers every reliability domain and fails closed", () => {
  const core = createDefaultLearningLoopCore();
  const validated = validateLearningLoopCore(core);
  const labels = validated.domains.map((domain) => domain.label);

  assert.deepEqual(
    validated.domains.map((domain) => domain.id),
    learningLoopDomains,
  );
  assert.deepEqual(labels, [
    "Core & Orchestration",
    "Memory & Knowledge",
    "Intelligence & Learning",
    "Code Quality & Testing",
    "Security & Compliance",
    "Architecture & Methodology",
    "DevOps & Observability",
    "Extensibility",
    "Domain-Specific",
  ]);
  assert.match(validated.loop.fail_closed_rule, /Unverified observations stay as candidate/);
  assert.equal(JSON.stringify(validated).includes(".omx"), false);
});

test("learning records persist separately and load newest-first", async () => {
  const tempRoot = createTestNamespace("ma-learning-records");
  const previousRoot = process.env.MA_ROOT;
  process.env.MA_ROOT = tempRoot;
  try {
    await appendLearningRecord({
      domain: "code_quality_testing",
      claim: "First verified result",
      source: "npm test",
      evidence: ["176 tests passed"],
      nextVerification: "npm run check",
      factIds: ["fact-0123456789abcdef"],
    });
    await appendLearningRecord({
      domain: "security_compliance",
      claim: "Second candidate result",
      source: "security scan",
      nextVerification: "repeat scan",
    });
    const records = await loadLearningRecords();
    assert.equal(records.length, 2);
    assert.equal(records[0].claim, "Second candidate result");
    assert.equal(records[0].status, "candidate");
    assert.deepEqual(records[1].fact_ids, ["fact-0123456789abcdef"]);
  } finally {
    if (previousRoot === undefined) delete process.env.MA_ROOT;
    else process.env.MA_ROOT = previousRoot;
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("Learning records remain candidates until verification promotes them", () => {
  const core = createDefaultLearningLoopCore();
  const record = createLearningRecord({
    domain: "code_quality_testing",
    claim: "Sequential node:test execution is more reliable for this package smoke suite.",
    source: "npm test",
    evidence: ["test/cli-smoke.test.js", "test/runtime-state.test.js"],
    nextVerification: "npm run release:check",
  });
  const next = addLearningRecord(core, record);
  const readiness = evaluateLearningLoopReadiness(next);

  assert.equal(next.records.length, 1);
  assert.equal(next.records[0].status, "candidate");
  assert.equal(next.records[0].cannot_mutate.includes("release_state_without_owning_lane"), true);
  assert.equal(readiness.ready, true);
  assert.equal(readiness.candidate_records, 1);
  assert.equal(readiness.verified_domains, 0);
});

test("learning records reject non-canonical fact references", () => {
  assert.throws(
    () =>
      createLearningRecord({
        domain: "code_quality_testing",
        claim: "Invalid fact reference",
        source: "test",
        nextVerification: "repeat test",
        factIds: ["not-a-fact"],
      }),
    /canonical fact IDs/,
  );
});

test("recordWorkLearning persists work evidence and mirrors only when a vault is supplied", async (t) => {
  const root = createTestNamespace("ma-learning-work");
  const vault = createTestNamespace("ma-learning-vault");
  const previousRoot = process.env.MA_ROOT;
  process.env.MA_ROOT = root;
  t.after(async () => {
    if (previousRoot === undefined) delete process.env.MA_ROOT;
    else process.env.MA_ROOT = previousRoot;
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(vault, { recursive: true, force: true });
  });
  const record = await recordWorkLearning({
    domain: "code_quality_testing",
    claim: "Work was verified",
    source: "npm test",
    evidence: ["3 tests passed"],
    filesInvolved: ["src/index.js"],
    nextVerification: "repeat npm test",
    vaultPath: vault,
  });
  assert.equal(record.files_involved[0], "src/index.js");
  assert.match(
    await fs.readFile(path.join(root, ".ma", "learning", "records.jsonl"), "utf8"),
    /Work was verified/,
  );
  assert.match(
    await fs.readFile(path.join(vault, "Meta-Architect", "Learning Memory.md"), "utf8"),
    /Work was verified/,
  );
});

test("failure memory records active, resolved, and stale failures with evidence", async (t) => {
  const root = createTestNamespace("ma-failure-memory");
  const vault = createTestNamespace("ma-failure-memory-vault");
  const previousRoot = process.env.MA_ROOT;
  process.env.MA_ROOT = root;
  t.after(async () => {
    if (previousRoot === undefined) delete process.env.MA_ROOT;
    else process.env.MA_ROOT = previousRoot;
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(vault, { recursive: true, force: true });
  });
  for (const resolutionStatus of ["active", "resolved", "stale"]) {
    const record = await recordFailureMemory({
      cause: `command ${resolutionStatus}`,
      source: "npm test",
      evidence: ["stderr receipt"],
      attemptedFixes: ["reran focused test"],
      resolutionStatus,
      vaultPath: resolutionStatus === "active" ? vault : undefined,
    });
    assert.equal(record.failure_state, resolutionStatus);
    assert.equal(record.resolution_status, resolutionStatus);
    assert.equal(record.status, resolutionStatus === "resolved" ? "verified" : "candidate");
  }
  assert.match(
    await fs.readFile(path.join(vault, "Meta-Architect", "Learning Memory.md"), "utf8"),
    /Failure state: active/,
  );
});

test("runInit seeds Learning Loop Core as a real runtime artifact", async () => {
  const tempRoot = createTestNamespace("ma-learning-loop");
  const previousRoot = process.env.MA_ROOT;
  process.env.MA_ROOT = tempRoot;
  try {
    await runInit();
    const seeded = await loadLearningLoopCore();

    assert.equal(seeded.schemaVersion, "0.1.0");
    assert.equal(seeded.domains.length, learningLoopDomains.length);
    await fs.access(path.join(tempRoot, ".ma", "context", "learning-loop-core.json"));
  } finally {
    if (previousRoot === undefined) {
      delete process.env.MA_ROOT;
    } else {
      process.env.MA_ROOT = previousRoot;
    }
  }
});
