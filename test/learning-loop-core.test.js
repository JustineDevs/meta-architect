import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  addLearningRecord,
  createDefaultLearningLoopCore,
  createLearningRecord,
  evaluateLearningLoopReadiness,
  learningLoopDomains,
  loadLearningLoopCore,
  validateLearningLoopCore,
} from "../src/runtime/learning-loop-core.js";
import { runInit } from "../src/skills.js";

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

test("runInit seeds Learning Loop Core as a real runtime artifact", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ma-learning-loop-"));
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
