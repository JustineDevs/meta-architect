import assert from "node:assert/strict";
import test from "node:test";
import {
  addSemanticReceipt,
  createDefaultCapabilityComposition,
  createDefaultSemanticReceiptIndex,
  createDefaultWorkspaceContextPack,
  createDefaultWorkspaceEffectiveness,
  createSemanticReceipt,
  evaluateWorkspaceEffectiveness,
  validateCapabilityComposition,
  validateWorkspaceContextPack,
} from "../src/runtime/workspace-intelligence-runtime.js";

test("Workspace Intelligence creates semantic receipts with explicit unlock boundaries", () => {
  const index = createDefaultSemanticReceiptIndex();
  const receipt = createSemanticReceipt({
    semanticRole: "brain_context",
    source: "obsidian_integration_core",
    claim: "Vault note informs planning context only.",
    provenance: [".ma/context/obsidian-bridge.json"],
    writes: ["vault_context"],
    unlocks: ["planning_context"],
    doesNotUnlock: ["build_evidence", "production_release"],
  });
  const next = addSemanticReceipt(index, receipt);

  assert.equal(next.receipts.length, 1);
  assert.equal(next.receipts[0].semantic_role, "brain_context");
  assert.equal(next.receipts[0].does_not_unlock.includes("build_evidence"), true);
  assert.equal(next.receipts[0].authority, "$maestro_or_owning_lane");
});

test("Workspace Intelligence effectiveness evaluation fails closed until checks pass or waive", () => {
  const document = createDefaultWorkspaceEffectiveness();
  const pending = evaluateWorkspaceEffectiveness(document);
  const passed = evaluateWorkspaceEffectiveness({
    ...document,
    checks: document.checks.map((check) => ({ ...check, status: "passed" })),
  });

  assert.equal(pending.ready, false);
  assert.equal(pending.blocking.includes("stack_identified"), true);
  assert.equal(passed.ready, true);
  assert.equal(passed.passed, document.checks.length);
});

test("Workspace Intelligence binds helper orchestration as non-gating support", () => {
  const composition = validateCapabilityComposition(createDefaultCapabilityComposition());
  const contextPack = validateWorkspaceContextPack(createDefaultWorkspaceContextPack());
  const helper = composition.capability_matrix.find(
    (entry) => entry.capability === "helper_orchestration_core",
  );

  assert.equal(helper.semantic_role, "non_gating_helper_support");
  assert.deepEqual(helper.supports, ["$align", "$diagnose", "$tdd", "$cleanup"]);
  assert.equal(helper.records_as, "helper_receipt");
  assert.equal(helper.never_records_as, "gate_approval");
  assert.equal(helper.cannot_mutate.includes(".ma/release.json"), true);
  assert.equal(
    contextPack.semantic_channels.helper_support.sources.includes("helper_orchestration_core"),
    true,
  );
});

test("Workspace Intelligence binds environment awareness as available capability context", () => {
  const composition = validateCapabilityComposition(createDefaultCapabilityComposition());
  const contextPack = validateWorkspaceContextPack(createDefaultWorkspaceContextPack());
  const environment = composition.capability_matrix.find(
    (entry) => entry.capability === "environment_awareness_core",
  );

  assert.equal(environment.semantic_role, "available_capability_discovery");
  assert.equal(environment.records_as, "available_capability");
  assert.equal(environment.never_records_as, "build_evidence");
  assert.equal(environment.cannot_mutate.includes("discovered_user_configs"), true);
  assert.equal(
    contextPack.semantic_channels.available_capabilities.sources.includes(
      "environment_awareness_core",
    ),
    true,
  );
});

test("Workspace Intelligence binds universal plugin broker as cross-agent compatibility config", () => {
  const composition = validateCapabilityComposition(createDefaultCapabilityComposition());
  const contextPack = validateWorkspaceContextPack(createDefaultWorkspaceContextPack());
  const broker = composition.capability_matrix.find(
    (entry) => entry.capability === "universal_plugin_broker_core",
  );

  assert.equal(broker.semantic_role, "cross_agent_plugin_broker");
  assert.equal(broker.records_as, "plugin_compatibility_configuration");
  assert.equal(broker.never_records_as, "build_evidence");
  assert.equal(broker.cannot_mutate.includes(".ma/release.json"), true);
  assert.equal(broker.cannot_mutate.includes("build_evidence"), true);
  assert.equal(broker.applies_to.includes("all_supported_context_layer_agents"), true);
  assert.equal(
    contextPack.semantic_channels.plugin_compatibility.sources.includes(
      "universal_plugin_broker_core",
    ),
    true,
  );
});
