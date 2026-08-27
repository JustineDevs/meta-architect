import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  AIQualityOrchestrator,
  calculateQualityScore,
} from "../src/quality/ai-quality-orchestrator.js";
import { createTestNamespace } from "../src/test-fixtures.js";

test("quality orchestrator blocks unsafe code and records bounded receipts", async (t) => {
  const root = createTestNamespace("ma-quality");
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const orchestrator = new AIQualityOrchestrator({
    projectRoot: root,
    semgrepRunner: async () => ({ passed: true, blocked: false, violations: [] }),
    llmGuard: async () => ({ passed: true, blocked: false, violations: [] }),
    sweBenchmark: async () => ({ passed: true }),
    kodCodeVerify: async () => ({ passed: true }),
  });
  const result = await orchestrator.validate(
    "const token = 'sk-12345678901234567890';\nfetch(url);",
    { filePath: "src/routes/users.ts", testEvidence: { approved: true } },
  );
  assert.equal(result.passed, false);
  assert.ok(result.violations.some((item) => item.rule === "no-hardcoded-secrets"));
  assert.ok(!result.violations.some((item) => item.rule === "tests-before-code"));
  assert.ok(
    Array.isArray(JSON.parse(await fs.readFile(path.join(root, ".ma/quality/violations.json")))),
  );
});

test("quality score stays within its documented range", async () => {
  assert.equal(
    calculateQualityScore({
      linesDeleted: 100,
      linesAdded: 1,
      cloudCostDelta: -1,
      p95LatencyDelta: 0,
      testCoverage: 1,
      securityIssuesFound: 0,
      securityIssuesFixed: 0,
    }),
    100,
  );
});

test("default external gates fail closed instead of claiming unavailable passes", async () => {
  const root = createTestNamespace("ma-quality-default");
  try {
    const orchestrator = new AIQualityOrchestrator({ projectRoot: root });
    const result = await orchestrator.validate("export const ok = true;", {
      testEvidence: { approved: true },
      testCoverage: 1,
    });
    assert.equal(result.passed, false);
    assert.ok(result.violations.some((item) => item.rule === "llm-guard-unavailable"));
    assert.ok(result.violations.some((item) => item.rule === "swe-bench"));
    assert.ok(result.violations.some((item) => item.rule === "kodcode"));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
