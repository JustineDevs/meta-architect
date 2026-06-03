import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import {
  classifyAutonomyBranch,
  createDefaultActiveAutonomyCore,
  detectPassivePermissionHandoff,
} from "../src/runtime/active-autonomy-core.js";

const promptSurfaces = [
  ".codex/prompts/enforcement.md",
  ".codex/prompts/skill-contract.md",
  "prompts/architect.md",
  "prompts/builder.md",
  "prompts/flow.md",
  "prompts/release-manager.md",
  "prompts/sage.md",
  "prompts/security-reviewer.md",
  "prompts/verifier.md",
  "prompts/vibe.md",
];

test("active autonomy prompt contract is present across prompt surfaces", async () => {
  for (const file of promptSurfaces) {
    const content = await fs.readFile(file, "utf8");

    assert.match(content, /AUTO-CONTINUE/, `${file} must name AUTO-CONTINUE`);
    assert.match(content, /ASK/, `${file} must name ASK`);
    assert.match(content, /destructive/, `${file} must include closed ASK reasons`);
    assert.match(content, /irreversible/, `${file} must include closed ASK reasons`);
    assert.match(content, /credential-gated/, `${file} must include closed ASK reasons`);
    assert.match(content, /external-production/, `${file} must include closed ASK reasons`);
    assert.match(content, /materially scope-changing/, `${file} must include closed ASK reasons`);
    assert.match(
      content,
      /Do not use permission-handoff phrasing/,
      `${file} must ban passive permission handoff`,
    );
  }
});

test("active autonomy contributor docs preserve anti-passive contract", async () => {
  const fragment = await fs.readFile(
    "docs/prompt-guidance-fragments/active-autonomy-core.md",
    "utf8",
  );
  const contract = await fs.readFile("docs/prompt-guidance-contract.md", "utf8");

  for (const content of [fragment, contract]) {
    assert.match(content, /AUTO-CONTINUE/);
    assert.match(content, /ASK/);
    assert.match(content, /permission-handoff/i);
    assert.match(content, /fresh verification evidence/i);
  }
});

test("active autonomy classifier auto-continues safe requested work and asks on closed-list risks", () => {
  const core = createDefaultActiveAutonomyCore();
  const safe = classifyAutonomyBranch({ core, requested: true });
  const destructive = classifyAutonomyBranch({
    core,
    requested: true,
    riskSignals: ["destructive_action"],
  });

  assert.equal(safe.mode, "AUTO-CONTINUE");
  assert.equal(safe.permission_handoff_allowed, false);
  assert.equal(destructive.mode, "ASK");
  assert.equal(destructive.reason, "destructive_action");
  assert.equal(detectPassivePermissionHandoff("Would you like me to continue?", core), true);
});

test("active autonomy hook is registered for stop enforcement", async () => {
  const hookConfig = JSON.parse(await fs.readFile(".codex/hooks.json", "utf8"));
  const stopHook = hookConfig.hooks?.Stop?.find((hook) =>
    `${hook.command}`.includes("active-autonomy-hook.mjs"),
  );

  assert.ok(stopHook, "Stop hook must register active autonomy runtime enforcement");
  assert.match(stopHook.command, /^node \.\/scripts\/active-autonomy-hook\.mjs$/);
  assert.equal(
    detectPassivePermissionHandoff(
      "Would you like me to continue?",
      createDefaultActiveAutonomyCore(),
    ),
    true,
  );
});
