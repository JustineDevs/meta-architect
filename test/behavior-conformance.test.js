import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { listContextResources } from "../mcp/local/context.js";

const surfaces = [
  ".codex/prompts/enforcement.md",
  ".codex/prompts/skill-contract.md",
  ".codex/prompts/onboarding.md",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/ISSUE_TEMPLATE/bug_report.yml",
  ".github/ISSUE_TEMPLATE/feature_request.yml",
  ".github/ISSUE_TEMPLATE/skill_contract_issue.yml",
];

test("public prompt and contribution surfaces preserve the behavior boundary", async () => {
  for (const file of surfaces) {
    const content = await fs.readFile(file, "utf8");
    assert.doesNotMatch(
      content,
      /(?:sk-[A-Za-z0-9]{12,}|ghp_[A-Za-z0-9]{12,}|BEGIN .*PRIVATE KEY)/,
    );
    assert.doesNotMatch(content, /(?:^|[ =])\/home\/[^\s)`]+/m);
  }
  const enforcement = await fs.readFile(".codex/prompts/enforcement.md", "utf8");
  assert.match(enforcement, /\.ma/);
  assert.match(enforcement, /evidence/i);
  assert.doesNotMatch(enforcement, /\.omx/);
});

test("onboarding names the umbrella manager and current .ma CLI surface", async () => {
  const onboarding = await fs.readFile(".codex/prompts/onboarding.md", "utf8");
  assert.match(onboarding, /\$maestro/);
  assert.match(onboarding, /ma setup/);
  assert.match(onboarding, /ma doctor/);
  assert.match(onboarding, /ma context refresh/);
  assert.match(onboarding, /\.ma/);
  assert.doesNotMatch(onboarding, /\.omx/);
});

test("context conformance exposes all read-only evidence surfaces", async () => {
  const resources = listContextResources();
  for (const resource of [
    "context://project-index",
    "context://learning",
    "context://obsidian",
    "context://hooks",
    "context://freshness",
    "context://preferences",
  ]) {
    assert.ok(resources.includes(resource), `${resource} must remain discoverable`);
  }
});
