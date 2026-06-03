import assert from "node:assert/strict";
import test from "node:test";
import {
  createDefaultPromptStrategyCore,
  resolvePromptStrategyForRole,
  resolvePromptStrategyForSurface,
} from "../src/runtime/prompt-strategy-core.js";

test("Prompt Strategy Core resolves MA-owned lane policy without overriding authority", () => {
  const resolution = resolvePromptStrategyForSurface({
    core: createDefaultPromptStrategyCore(),
    surface: "$build",
    risk: "security",
  });

  assert.equal(resolution.record_type, "prompt_strategy_resolution");
  assert.equal(resolution.surface, "$build");
  assert.equal(resolution.techniques.includes("decomposition_sequence"), true);
  assert.equal(resolution.techniques.includes("reasoning_validation"), true);
  assert.equal(resolution.techniques.includes("safety_integrity"), true);
  assert.equal(resolution.evidence_source.repo, "NirDiamant/Prompt_Engineering");
  assert.equal(resolution.authority_boundary.may_override_lane_authority, false);
  assert.equal(resolution.authority_boundary.may_remove_safety_language, false);
});

test("Prompt Strategy Core resolves role policy for executor and verifier surfaces", () => {
  const core = createDefaultPromptStrategyCore();
  const executor = resolvePromptStrategyForRole({
    core,
    role: "executor",
    surface: "$build",
    risk: "standard",
  });
  const verifier = resolvePromptStrategyForRole({
    core,
    role: "verifier",
    surface: "ralph_execution_core",
    risk: "release",
  });

  assert.equal(executor.record_type, "prompt_strategy_role_resolution");
  assert.equal(executor.output_contract.evidence_required, true);
  assert.equal(executor.techniques.includes("decomposition_sequence"), true);
  assert.equal(executor.techniques.includes("generation_constraints"), true);
  assert.equal(verifier.techniques.includes("reasoning_validation"), true);
  assert.equal(verifier.techniques.includes("safety_integrity"), true);
  assert.equal(verifier.output_contract.private_reasoning_reported, false);
});
