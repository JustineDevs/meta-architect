import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { createTempRepo } from "./helpers/temp-repo.js";

const repoRoot = process.cwd();
const cleanDecisions = {
  schemaVersion: "0.1.0",
  idea_status: "DRAFT",
  architecture_status: "DRAFT",
  evidence_status: "MISSING",
  logic_status: "PENDING",
  security_status: "PENDING",
  experience_status: "PENDING",
  build_status: "LOCKED",
  merge_status: "LOCKED",
  release_status: "LOCKED",
  decisions: [],
};
const cleanRelease = {
  schemaVersion: "0.1.0",
  idea_status: "DRAFT",
  architecture_status: "DRAFT",
  evidence_status: "MISSING",
  logic_status: "PENDING",
  security_status: "PENDING",
  experience_status: "PENDING",
  build_status: "LOCKED",
  merge_status: "LOCKED",
  release_status: "LOCKED",
  waiver: null,
  updatedAt: "2026-04-30T00:00:00.000Z",
};
const realisticReleaseHardeningIdea =
  "Harden Meta-Architect v0.1.13 semantic core with Obsidian vault context, Ralph execution proof, context economy, and package-gated release evidence";

async function loadModules() {
  const stamp = Date.now();
  const skills = await import(
    `${pathToFileURL(path.join(repoRoot, "src", "skills.js")).href}?t=${stamp}`
  );
  const decisions = await import(
    `${pathToFileURL(path.join(repoRoot, "src", "decision-log.js")).href}?t=${stamp}`
  );
  const stateSync = await import(
    `${pathToFileURL(path.join(repoRoot, "src", "state-sync.js")).href}?t=${stamp}`
  );
  const release = await import(
    `${pathToFileURL(path.join(repoRoot, "src", "release-state.js")).href}?t=${stamp}`
  );
  const fsUtils = await import(
    `${pathToFileURL(path.join(repoRoot, "src", "fs-utils.js")).href}?t=${stamp}`
  );
  const bootstrap = await import(
    `${pathToFileURL(path.join(repoRoot, "src", "bootstrap.js")).href}?t=${stamp}`
  );
  const { spawnPortable } = await import(
    `${pathToFileURL(path.join(repoRoot, "test", "helpers", "spawn-portable.js")).href}?t=${stamp}`
  );
  const buildReadiness = await import(
    `${pathToFileURL(path.join(repoRoot, "src", "runtime", "build-readiness.js")).href}?t=${stamp}`
  );
  const runtimeState = await import(
    `${pathToFileURL(path.join(repoRoot, "src", "runtime", "runtime-state.js")).href}?t=${stamp}`
  );
  return {
    skills,
    decisions,
    stateSync,
    release,
    fsUtils,
    bootstrap,
    spawnPortable,
    buildReadiness,
    runtimeState,
  };
}

async function withTempRepo(run) {
  const tempRoot = await createTempRepo("meta-architect-runtime-state-", repoRoot);
  const previousRoot = process.env.MA_ROOT;
  const previousCodexHome = process.env.CODEX_HOME;
  const previousCodexBin = process.env.MA_CODEX_BIN;
  process.env.MA_ROOT = tempRoot;

  try {
    return await run(tempRoot);
  } finally {
    if (previousRoot === undefined) {
      delete process.env.MA_ROOT;
    } else {
      process.env.MA_ROOT = previousRoot;
    }

    if (previousCodexHome === undefined) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = previousCodexHome;
    }

    if (previousCodexBin === undefined) {
      delete process.env.MA_CODEX_BIN;
    } else {
      process.env.MA_CODEX_BIN = previousCodexBin;
    }
  }
}

function getManagerRunsPath(tempRoot) {
  return path.join(tempRoot, ".ma", "state", "manager-runs.json");
}

function getMaestroStatePath(tempRoot) {
  return path.join(tempRoot, ".ma", "state", "maestro-state.json");
}

function getMaestroEventsPath(tempRoot) {
  return path.join(tempRoot, ".ma", "logs", "maestro-events.ndjson");
}

function getActiveAutonomyCorePath(tempRoot) {
  return path.join(tempRoot, ".ma", "context", "active-autonomy-core.json");
}

function getSemanticRecordingCorePath(tempRoot) {
  return path.join(tempRoot, ".ma", "context", "recording-core.json");
}

function getHelperOrchestrationCorePath(tempRoot) {
  return path.join(tempRoot, ".ma", "context", "helper-orchestration-core.json");
}

function getPromptStrategyCorePath(tempRoot) {
  return path.join(tempRoot, ".ma", "context", "prompt-strategy-core.json");
}

function getContextEconomyCorePath(tempRoot) {
  return path.join(tempRoot, ".ma", "context", "context-economy-core.json");
}

function getEnvironmentAwarenessCorePath(tempRoot) {
  return path.join(tempRoot, ".ma", "context", "environment-awareness-core.json");
}

function getUniversalPluginBrokerCorePath(tempRoot) {
  return path.join(tempRoot, ".ma", "context", "universal-plugin-broker-core.json");
}

function getObsidianBridgePath(tempRoot) {
  return path.join(tempRoot, ".ma", "context", "obsidian-bridge.json");
}

function getWorkspaceVirtualizerPath(tempRoot) {
  return path.join(tempRoot, ".ma", "context", "workspace-virtualizer.json");
}

function getCodeGraphRehearsePath(tempRoot) {
  return path.join(tempRoot, ".ma", "context", "code-graph-rehearse.json");
}

function getSkillsRegistryExportPath(tempRoot) {
  return path.join(tempRoot, ".ma", "context", "skills-registry-export.json");
}

function getCapabilityCompositionPath(tempRoot) {
  return path.join(tempRoot, ".ma", "context", "capability-composition.json");
}

function getWorkspaceContextPackPath(tempRoot) {
  return path.join(tempRoot, ".ma", "context", "workspace-context-pack.json");
}

function getWorkspaceEffectivenessPath(tempRoot) {
  return path.join(tempRoot, ".ma", "context", "workspace-effectiveness.json");
}

function getSemanticReceiptIndexPath(tempRoot) {
  return path.join(tempRoot, ".ma", "evidence", "semantic-receipts.json");
}

async function loadMaestroEvents(tempRoot) {
  const raw = await fs.readFile(getMaestroEventsPath(tempRoot), "utf8");
  return raw
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function loadManagerRuns(tempRoot) {
  return JSON.parse(await fs.readFile(getManagerRunsPath(tempRoot), "utf8"));
}

test("runInit seeds manager-run persistence for autonomous maestro state", async () => {
  await withTempRepo(async (tempRoot) => {
    const { skills } = await loadModules();

    await skills.runInit();

    const managerRuns = await loadManagerRuns(tempRoot);
    const maestroState = JSON.parse(await fs.readFile(getMaestroStatePath(tempRoot), "utf8"));
    assert.equal(managerRuns.schemaVersion, "0.1.0");
    assert.deepEqual(managerRuns.runs, []);
    assert.equal(maestroState.schemaVersion, "0.1.0");
    assert.equal(maestroState.global_status, "IDLE");
    assert.deepEqual(Object.keys(maestroState.runtime_tracks), []);
  });
});

test("runInit seeds MA semantic recording core without exposing OMX paths", async () => {
  await withTempRepo(async (tempRoot) => {
    const { skills, runtimeState } = await loadModules();

    await skills.runInit();

    const [
      activeAutonomyCore,
      recordingCore,
      helperOrchestrationCore,
      promptStrategyCore,
      contextEconomyCore,
      environmentAwarenessCore,
      universalPluginBrokerCore,
      obsidianBridge,
      workspaceVirtualizer,
      codeGraphRehearse,
      skillsRegistryExport,
      capabilityComposition,
      workspaceContextPack,
      workspaceEffectiveness,
      receipts,
    ] = await Promise.all([
      fs.readFile(getActiveAutonomyCorePath(tempRoot), "utf8").then(JSON.parse),
      fs.readFile(getSemanticRecordingCorePath(tempRoot), "utf8").then(JSON.parse),
      fs.readFile(getHelperOrchestrationCorePath(tempRoot), "utf8").then(JSON.parse),
      fs.readFile(getPromptStrategyCorePath(tempRoot), "utf8").then(JSON.parse),
      fs.readFile(getContextEconomyCorePath(tempRoot), "utf8").then(JSON.parse),
      fs.readFile(getEnvironmentAwarenessCorePath(tempRoot), "utf8").then(JSON.parse),
      fs.readFile(getUniversalPluginBrokerCorePath(tempRoot), "utf8").then(JSON.parse),
      fs.readFile(getObsidianBridgePath(tempRoot), "utf8").then(JSON.parse),
      fs.readFile(getWorkspaceVirtualizerPath(tempRoot), "utf8").then(JSON.parse),
      fs.readFile(getCodeGraphRehearsePath(tempRoot), "utf8").then(JSON.parse),
      fs.readFile(getSkillsRegistryExportPath(tempRoot), "utf8").then(JSON.parse),
      fs.readFile(getCapabilityCompositionPath(tempRoot), "utf8").then(JSON.parse),
      fs.readFile(getWorkspaceContextPackPath(tempRoot), "utf8").then(JSON.parse),
      fs.readFile(getWorkspaceEffectivenessPath(tempRoot), "utf8").then(JSON.parse),
      fs.readFile(getSemanticReceiptIndexPath(tempRoot), "utf8").then(JSON.parse),
    ]);
    const snapshot = await runtimeState.loadRuntimeSnapshot();
    const summary = runtimeState.createRuntimeSummary(snapshot);
    const obsidianComposition = capabilityComposition.capability_matrix.find(
      (entry) => entry.capability === "obsidian_integration_core",
    );
    const ralphComposition = capabilityComposition.capability_matrix.find(
      (entry) => entry.capability === "ralph_execution_core",
    );
    const promptStrategyComposition = capabilityComposition.capability_matrix.find(
      (entry) => entry.capability === "prompt_strategy_core",
    );
    const activeAutonomyComposition = capabilityComposition.capability_matrix.find(
      (entry) => entry.capability === "active_autonomy_core",
    );
    const helperComposition = capabilityComposition.capability_matrix.find(
      (entry) => entry.capability === "helper_orchestration_core",
    );
    const environmentComposition = capabilityComposition.capability_matrix.find(
      (entry) => entry.capability === "environment_awareness_core",
    );
    const brokerComposition = capabilityComposition.capability_matrix.find(
      (entry) => entry.capability === "universal_plugin_broker_core",
    );

    assert.equal(activeAutonomyCore.decision_rule.modes.includes("AUTO-CONTINUE"), true);
    assert.equal(activeAutonomyCore.decision_rule.modes.includes("ASK"), true);
    assert.deepEqual(activeAutonomyCore.decision_rule.ask_only_when, [
      "destructive_action",
      "irreversible_action",
      "credential_gated_action",
      "external_production_side_effect",
      "material_scope_change",
      "missing_authority_blocks_progress",
    ]);
    assert.equal(
      activeAutonomyCore.runtime_enforcement.stall_patterns.includes("should i proceed"),
      true,
    );
    assert.equal(
      activeAutonomyCore.completion_loop_contract.completion_requires.includes(
        "fresh_verification_evidence",
      ),
      true,
    );
    assert.equal(recordingCore.schemaVersion, "0.1.0");
    assert.equal(recordingCore.product, "Meta-Architect");
    assert.equal(recordingCore.layers.length, 6);
    assert.deepEqual(
      helperOrchestrationCore.helper_contracts.map((contract) => contract.skill),
      ["$align", "$diagnose", "$tdd", "$cleanup"],
    );
    assert.equal(helperOrchestrationCore.composition_rules.non_gating, true);
    assert.equal(helperOrchestrationCore.composition_rules.release_state_mutation_allowed, false);
    assert.equal(helperOrchestrationCore.composition_rules.never_records_as, "gate_approval");
    assert.equal(
      recordingCore.default_core_capabilities.obsidian_integration_core.semantic_role,
      "brain_context",
    );
    assert.equal(
      recordingCore.default_core_capabilities.obsidian_integration_core.records_as,
      "vault_context",
    );
    assert.equal(
      recordingCore.default_core_capabilities.obsidian_integration_core.never_records_as,
      "build_evidence",
    );
    assert.equal(obsidianBridge.semantic_boundary.records_as, "vault_context");
    assert.equal(obsidianBridge.semantic_boundary.never_records_as, "build_evidence");
    assert.equal(
      obsidianBridge.compatibility_references.sample_plugin_structure,
      "https://github.com/obsidianmd/obsidian-sample-plugin",
    );
    assert.deepEqual(obsidianBridge.plugin_contract.must_not_mutate, [
      ".ma/release.json",
      ".ma/decisions.json",
      ".ma/plans/",
      ".ma/specs/",
    ]);
    assert.equal(
      obsidianBridge.plugin_contract.authoritative_changes_return_through,
      "$maestro_or_owning_lane",
    );
    assert.equal(obsidianComposition.semantic_role, "brain_context");
    assert.equal(obsidianComposition.records_as, "vault_context");
    assert.equal(obsidianComposition.never_records_as, "build_evidence");
    assert.deepEqual(ralphComposition.reads, [
      "approved_prd",
      "test_spec",
      "semantic_receipts",
      "workspace_context_pack",
    ]);
    assert.equal(promptStrategyCore.evidence_source.repo, "NirDiamant/Prompt_Engineering");
    assert.equal(promptStrategyCore.technique_families.length, 6);
    assert.deepEqual(promptStrategyCore.lane_policy.$build, [
      "decomposition_sequence",
      "reasoning_validation",
      "safety_integrity",
    ]);
    assert.equal(contextEconomyCore.applies_to.includes("$maestro"), true);
    assert.equal(contextEconomyCore.applies_to.includes("team_workers"), true);
    assert.equal(contextEconomyCore.preserve_exact.includes("code_blocks"), true);
    assert.equal(contextEconomyCore.preserve_exact.includes("security_warnings"), true);
    assert.equal(contextEconomyCore.safety_valves.includes("verification failed"), true);
    assert.equal(environmentAwarenessCore.discovery_policy.records_as, "available_capability");
    assert.equal(environmentAwarenessCore.discovery_policy.never_records_as, "build_evidence");
    assert.equal(environmentAwarenessCore.discovery_policy.auto_run_discovered_tools, false);
    assert.equal(environmentAwarenessCore.capabilities.length > 0, true);
    assert.equal(
      environmentAwarenessCore.capabilities.every(
        (capability) =>
          capability.records_as === "available_capability" &&
          capability.never_records_as === "build_evidence" &&
          capability.mutation_allowed === false,
      ),
      true,
    );
    assert.equal(promptStrategyComposition.semantic_role, "prompt_strategy");
    assert.equal(promptStrategyComposition.evidence_source, "NirDiamant/Prompt_Engineering");
    assert.equal(activeAutonomyComposition.semantic_role, "anti_passive_execution_contract");
    assert.equal(helperComposition.semantic_role, "non_gating_helper_support");
    assert.equal(helperComposition.records_as, "helper_receipt");
    assert.equal(helperComposition.never_records_as, "gate_approval");
    assert.deepEqual(helperComposition.supports, ["$align", "$diagnose", "$tdd", "$cleanup"]);
    assert.equal(environmentComposition.semantic_role, "available_capability_discovery");
    assert.equal(environmentComposition.records_as, "available_capability");
    assert.equal(environmentComposition.never_records_as, "build_evidence");
    assert.equal(
      universalPluginBrokerCore.architecture.tooling_layer.protocol,
      "MCP stdio JSON-RPC",
    );
    assert.equal(
      universalPluginBrokerCore.architecture.context_layer.canonical_skill_dir,
      ".agents/skills",
    );
    assert.equal(universalPluginBrokerCore.mcp_injector_hosts.includes("claude-code"), true);
    assert.equal(universalPluginBrokerCore.mcp_injector_hosts.includes("antigravity"), true);
    assert.equal(universalPluginBrokerCore.mcp_injector_hosts.includes("cursor"), true);
    assert.equal(universalPluginBrokerCore.mcp_injector_hosts.includes("codex"), true);
    assert.equal(universalPluginBrokerCore.mutation_policy.may_mutate_release_state, false);
    assert.equal(
      universalPluginBrokerCore.mutation_policy.records_as,
      "plugin_compatibility_configuration",
    );
    assert.equal(universalPluginBrokerCore.mutation_policy.never_records_as, "build_evidence");
    assert.equal(brokerComposition.semantic_role, "cross_agent_plugin_broker");
    assert.equal(brokerComposition.records_as, "plugin_compatibility_configuration");
    assert.equal(brokerComposition.never_records_as, "build_evidence");
    assert.equal(
      promptStrategyCore.lane_policy.active_autonomy_core.includes("safety_integrity"),
      true,
    );
    assert.equal(workspaceVirtualizer.evidence_boundary.records_as, "virtual_workspace_result");
    assert.equal(workspaceVirtualizer.evidence_boundary.never_records_as, "production_evidence");
    assert.equal(workspaceVirtualizer.mutation_policy.may_mutate_source, false);
    assert.equal(codeGraphRehearse.evidence_boundary.records_as, "rehearsal_trace");
    assert.equal(codeGraphRehearse.mutation_policy.may_mutate_source, false);
    assert.equal(codeGraphRehearse.max_steps, 12);
    assert.equal(skillsRegistryExport.canonical_dir, ".agents/skills");
    assert.equal(skillsRegistryExport.universal_targets.includes("codex"), true);
    assert.equal(skillsRegistryExport.non_universal_targets.includes("claude-code"), true);
    assert.equal(
      skillsRegistryExport.authority_boundary.exported_payloads_may_mutate_release_state,
      false,
    );
    assert.equal(
      workspaceContextPack.workspace_identity.skill_policy,
      "ui_shortcuts_over_shared_runtime_contracts",
    );
    assert.equal(
      workspaceContextPack.semantic_channels.brain_context.sources.includes(
        "obsidian_integration_core",
      ),
      true,
    );
    assert.equal(
      workspaceContextPack.semantic_channels.technical_evidence.sources.includes("$sage"),
      true,
    );
    assert.equal(
      workspaceContextPack.semantic_channels.prompt_strategy.sources.includes(
        "prompt_strategy_core",
      ),
      true,
    );
    assert.equal(
      workspaceContextPack.semantic_channels.active_autonomy.sources.includes(
        "active_autonomy_core",
      ),
      true,
    );
    assert.equal(
      workspaceContextPack.semantic_channels.helper_support.sources.includes(
        "helper_orchestration_core",
      ),
      true,
    );
    assert.equal(
      workspaceContextPack.semantic_channels.available_capabilities.sources.includes(
        "environment_awareness_core",
      ),
      true,
    );
    assert.equal(
      workspaceContextPack.semantic_channels.plugin_compatibility.sources.includes(
        "universal_plugin_broker_core",
      ),
      true,
    );
    assert.equal(
      workspaceEffectiveness.checks.some((check) => check.id === "semantic_receipts_available"),
      true,
    );
    assert.equal(
      workspaceEffectiveness.checks.some((check) => check.id === "prompt_strategy_bound"),
      true,
    );
    assert.equal(
      workspaceEffectiveness.checks.some((check) => check.id === "active_autonomy_bound"),
      true,
    );
    assert.equal(
      workspaceEffectiveness.checks.some((check) => check.id === "helper_support_bound"),
      true,
    );
    assert.equal(
      workspaceEffectiveness.checks.some((check) => check.id === "environment_awareness_bound"),
      true,
    );
    assert.equal(
      workspaceEffectiveness.checks.some((check) => check.id === "universal_plugin_broker_bound"),
      true,
    );
    assert.equal(snapshot.hookConfig.activeAutonomy.enabled, true);
    assert.equal(
      snapshot.hookConfig.activeAutonomy.stallPatterns.includes("should i proceed"),
      true,
    );
    assert.equal(receipts.receipt_schema.semantic_role, "string");
    assert.deepEqual(receipts.receipts, []);
    assert.equal(
      [
        activeAutonomyCore,
        recordingCore,
        helperOrchestrationCore,
        promptStrategyCore,
        contextEconomyCore,
        environmentAwarenessCore,
        universalPluginBrokerCore,
        obsidianBridge,
        workspaceVirtualizer,
        codeGraphRehearse,
        skillsRegistryExport,
        capabilityComposition,
        workspaceContextPack,
        workspaceEffectiveness,
        receipts,
      ].some((artifact) => JSON.stringify(artifact).includes(".omx")),
      false,
    );
    assert.equal(summary.activeAutonomyAskOnlyCount, 6);
    assert.equal(summary.activeAutonomyStallPatternCount, 7);
    assert.equal(summary.activeAutonomyHookEnabled, true);
    assert.equal(summary.semanticRecordingLayerCount, 6);
    assert.equal(summary.semanticDefaultCoreCount, 3);
    assert.equal(summary.helperCoreContractCount, 4);
    assert.equal(summary.helperCoreNonGating, true);
    assert.equal(summary.helperCoreReleaseMutationAllowed, false);
    assert.equal(summary.promptStrategyTechniqueFamilyCount, 6);
    assert.equal(summary.promptStrategyLaneCount, 10);
    assert.equal(summary.contextEconomyAppliesToCount, 9);
    assert.equal(summary.contextEconomyPreserveExactCount, 8);
    assert.equal(summary.contextEconomySafetyValveCount, 7);
    assert.equal(summary.environmentCapabilityCount > 0, true);
    assert.equal(summary.environmentCapabilityTypes.includes("skill"), true);
    assert.equal(summary.environmentRecordsAs, "available_capability");
    assert.equal(summary.environmentNeverRecordsAs, "build_evidence");
    assert.equal(summary.universalPluginBrokerSupportedAgentCount, 55);
    assert.equal(summary.universalPluginBrokerMcpInjectorHosts, 4);
    assert.equal(summary.universalPluginBrokerRecordsAs, "plugin_compatibility_configuration");
    assert.equal(summary.universalPluginBrokerNeverRecordsAs, "build_evidence");
    assert.equal(summary.obsidianBridgeRecordsAs, "vault_context");
    assert.equal(summary.obsidianBridgeNeverRecordsAs, "build_evidence");
    assert.equal(summary.obsidianBridgeQueuedRequestCount, 0);
    assert.equal(summary.obsidianBridgeNoteSelectionCount, 0);
    assert.equal(summary.obsidianBridgeTagGraphClaimCount, 0);
    assert.equal(summary.workspaceVirtualizerRecordsAs, "virtual_workspace_result");
    assert.equal(summary.codeGraphRehearseMaxSteps, 12);
    assert.equal(summary.skillsRegistryUniversalTargetCount, 15);
    assert.equal(summary.skillsRegistryNonUniversalTargetCount, 40);
    assert.equal(summary.capabilityCompositionCount, 14);
    assert.equal(summary.workspaceContextChannelCount, 11);
    assert.equal(summary.workspaceEffectivenessReady, false);
    assert.equal(summary.workspaceEffectivenessCheckCount, 11);
    assert.equal(summary.semanticReceiptCount, 0);
    assert.equal(summary.obsidianSemanticRole, "brain_context");
    assert.equal(summary.obsidianRecordsAs, "vault_context");
    assert.equal(snapshot.missingArtifacts.includes("context.activeAutonomyCore"), false);
    assert.equal(snapshot.missingArtifacts.includes("context.recordingCore"), false);
    assert.equal(snapshot.missingArtifacts.includes("context.helperOrchestrationCore"), false);
    assert.equal(snapshot.missingArtifacts.includes("context.promptStrategyCore"), false);
    assert.equal(snapshot.missingArtifacts.includes("context.contextEconomyCore"), false);
    assert.equal(snapshot.missingArtifacts.includes("context.environmentAwarenessCore"), false);
    assert.equal(snapshot.missingArtifacts.includes("context.universalPluginBrokerCore"), false);
    assert.equal(snapshot.missingArtifacts.includes("context.obsidianBridge"), false);
    assert.equal(snapshot.missingArtifacts.includes("context.workspaceVirtualizer"), false);
    assert.equal(snapshot.missingArtifacts.includes("context.codeGraphRehearse"), false);
    assert.equal(snapshot.missingArtifacts.includes("context.skillsRegistryExport"), false);
    assert.equal(snapshot.missingArtifacts.includes("context.capabilityComposition"), false);
    assert.equal(snapshot.missingArtifacts.includes("context.workspaceContextPack"), false);
    assert.equal(snapshot.missingArtifacts.includes("context.workspaceEffectiveness"), false);
    assert.equal(snapshot.missingArtifacts.includes("evidence.semanticReceipts"), false);
    assert.equal(snapshot.invalidArtifacts.includes("context.activeAutonomyCore"), false);
    assert.equal(snapshot.invalidArtifacts.includes("context.recordingCore"), false);
    assert.equal(snapshot.invalidArtifacts.includes("context.helperOrchestrationCore"), false);
    assert.equal(snapshot.invalidArtifacts.includes("context.promptStrategyCore"), false);
    assert.equal(snapshot.invalidArtifacts.includes("context.contextEconomyCore"), false);
    assert.equal(snapshot.invalidArtifacts.includes("context.environmentAwarenessCore"), false);
    assert.equal(snapshot.invalidArtifacts.includes("context.universalPluginBrokerCore"), false);
    assert.equal(snapshot.invalidArtifacts.includes("context.obsidianBridge"), false);
    assert.equal(snapshot.invalidArtifacts.includes("context.workspaceVirtualizer"), false);
    assert.equal(snapshot.invalidArtifacts.includes("context.codeGraphRehearse"), false);
    assert.equal(snapshot.invalidArtifacts.includes("context.skillsRegistryExport"), false);
    assert.equal(snapshot.invalidArtifacts.includes("context.capabilityComposition"), false);
    assert.equal(snapshot.invalidArtifacts.includes("context.workspaceContextPack"), false);
    assert.equal(snapshot.invalidArtifacts.includes("context.workspaceEffectiveness"), false);
    assert.equal(snapshot.invalidArtifacts.includes("evidence.semanticReceipts"), false);
  });
});

test("build lane owns build status transitions and scratchpad ledger updates", async () => {
  await withTempRepo(async (tempRoot) => {
    const { skills, stateSync, fsUtils, release } = await loadModules();

    await skills.runInit();
    await fsUtils.writeJson(path.join(tempRoot, ".ma", "decisions.json"), cleanDecisions);
    await stateSync.syncStatusUpdates({
      idea_status: "CLEAR",
      architecture_status: "APPROVED",
      evidence_status: "VERIFIED",
      logic_status: "GREEN",
      security_status: "GREEN",
      experience_status: "GREEN",
    });

    const ready = await skills.runBuildLane();
    assert.equal(ready.status, "READY");
    assert.equal((await release.loadReleaseState()).build_status, "READY");

    const running = await skills.runBuildLane();
    assert.equal(running.status, "RUNNING");
    assert.equal((await release.loadReleaseState()).build_status, "RUNNING");

    const done = await skills.runBuildLane();
    assert.equal(done.status, "DONE");
    assert.equal((await release.loadReleaseState()).build_status, "DONE");

    const buildPlan = await fs.readFile(path.join(tempRoot, ".ma", "plans", "build.md"), "utf8");
    const ralphPrd = JSON.parse(
      await fs.readFile(path.join(tempRoot, ".ma", "plans", "prd.json"), "utf8"),
    );
    const ralphProgress = await fs.readFile(
      path.join(tempRoot, ".ma", "plans", "progress.txt"),
      "utf8",
    );
    const maestroState = JSON.parse(await fs.readFile(getMaestroStatePath(tempRoot), "utf8"));
    const maestroEvents = await loadMaestroEvents(tempRoot);

    assert.match(buildPlan, /## Build Slice/);
    assert.match(buildPlan, /## Verification Plan/);
    assert.match(buildPlan, /## Completion Evidence/);
    assert.match(buildPlan, /## Context Boundaries/);
    assert.match(buildPlan, /virtual workspace records as: virtual_workspace_result/);
    assert.match(buildPlan, /virtual workspace never records as: production_evidence/);
    assert.match(buildPlan, /code graph rehearsal records as: rehearsal_trace/);
    assert.match(buildPlan, /skills registry canonical dir: \.agents\/skills/);
    assert.match(buildPlan, /Obsidian context records as: vault_context/);
    assert.match(buildPlan, /brain context, not build evidence/);
    assert.equal(ralphPrd.authority, "$maestro_or_owning_lane_dispatch");
    assert.equal(ralphPrd.evidenceBoundary.obsidianRecordsAs, "vault_context");
    assert.equal(ralphPrd.evidenceBoundary.releaseStateMutationAllowed, false);
    assert.deepEqual(ralphPrd.qualityGates, ["$arch", "$sage", "$flow", "$vet", "$vibe", "$build"]);
    assert.equal(ralphPrd.userStories[0].passes, false);
    assert.match(
      ralphPrd.userStories[0].acceptanceCriteria.join("\n"),
      /Do not mutate \.ma\/release\.json/,
    );
    assert.match(ralphProgress, /US-001 awaits MA-gated execution/);
    assert.equal(maestroState.global_status, "COMPLETED");
    assert.equal(maestroState.runtime_tracks.track_0_sync.active_gate, "$build");
    assert.equal(maestroState.runtime_tracks.track_0_sync.status, "COMPLETED");
    assert.equal(maestroState.downstream_lock_table.$build.is_locked, false);
    assert.equal(
      maestroEvents.some(
        (event) =>
          event.record_type === "runtime:track_status" &&
          event.gate === "$build" &&
          event.build_status === "DONE",
      ),
      true,
    );
    assert.equal(
      maestroEvents.some(
        (event) =>
          event.record_type === "lock:downstream_circuit_breaker" &&
          event.target_gate === "$build" &&
          event.is_locked === false,
      ),
      true,
    );
  });
});

test("build lane quorum mode fails closed to READY on incompatible majority review", async () => {
  await withTempRepo(async (tempRoot) => {
    const { skills, stateSync, fsUtils, release } = await loadModules();

    await skills.runInit();
    await fsUtils.writeJson(path.join(tempRoot, ".ma", "decisions.json"), cleanDecisions);
    await stateSync.syncStatusUpdates({
      idea_status: "CLEAR",
      architecture_status: "APPROVED",
      evidence_status: "VERIFIED",
      logic_status: "GREEN",
      security_status: "GREEN",
      experience_status: "GREEN",
    });

    await skills.runBuildLane();
    await skills.runBuildLane();

    const quorumReady = await skills.runBuildLane({
      reviewMode: "quorum",
      quorumVotes: [
        {
          model_identifier: "model-a",
          decision: "APPROVED",
          fingerprint: { hash: "a" },
          blockers: [],
          evidence_hash: "hash-a",
          rationale_summary: "approved",
        },
        {
          model_identifier: "model-b",
          decision: "APPROVED",
          fingerprint: { hash: "b" },
          blockers: [],
          evidence_hash: "hash-b",
          rationale_summary: "approved but different fingerprint",
        },
        {
          model_identifier: "model-c",
          decision: "REJECTED",
          fingerprint: { hash: "c" },
          blockers: ["policy mismatch"],
          evidence_hash: "hash-c",
          rationale_summary: "rejected",
        },
      ],
    });

    assert.equal(quorumReady.status, "READY");
    assert.equal((await release.loadReleaseState()).build_status, "READY");
  });
});

test("build lane quorum mode can approve a majority-compatible review and complete", async () => {
  await withTempRepo(async (tempRoot) => {
    const { skills, stateSync, fsUtils, release } = await loadModules();

    await skills.runInit();
    await fsUtils.writeJson(path.join(tempRoot, ".ma", "decisions.json"), cleanDecisions);
    await stateSync.syncStatusUpdates({
      idea_status: "CLEAR",
      architecture_status: "APPROVED",
      evidence_status: "VERIFIED",
      logic_status: "GREEN",
      security_status: "GREEN",
      experience_status: "GREEN",
    });

    await skills.runBuildLane();
    await skills.runBuildLane();

    const quorumDone = await skills.runBuildLane({
      reviewMode: "quorum",
      quorumVotes: [
        {
          model_identifier: "model-a",
          decision: "APPROVED",
          fingerprint: { hash: "shared" },
          blockers: [],
          evidence_hash: "hash-a",
          rationale_summary: "approved",
        },
        {
          model_identifier: "model-b",
          decision: "APPROVED",
          fingerprint: { hash: "shared" },
          blockers: [],
          evidence_hash: "hash-b",
          rationale_summary: "approved",
        },
        {
          model_identifier: "model-c",
          decision: "REJECTED",
          fingerprint: { hash: "other" },
          blockers: ["policy mismatch"],
          evidence_hash: "hash-c",
          rationale_summary: "rejected",
        },
      ],
    });

    assert.equal(quorumDone.status, "DONE");
    assert.equal((await release.loadReleaseState()).build_status, "DONE");
    const decisions = JSON.parse(
      await fs.readFile(path.join(tempRoot, ".ma", "decisions.json"), "utf8"),
    );
    const latest = decisions.decisions.at(-1);
    assert.equal(
      latest.evidence.some((entry) => entry.kind === "completion-evidence"),
      true,
    );
    assert.equal(
      latest.evidence
        .find((entry) => entry.kind === "completion-evidence")
        .value.some((item) => /Quorum confidence receipt/.test(item)),
      true,
    );
  });
});

test("maestro auto-heal repairs scratchpad artifacts and resumes bounded progress", async () => {
  await withTempRepo(async (tempRoot) => {
    const { skills, stateSync, fsUtils, release } = await loadModules();

    await skills.runInit();
    await fsUtils.writeJson(path.join(tempRoot, ".ma", "decisions.json"), cleanDecisions);
    await stateSync.syncStatusUpdates({
      idea_status: "CLEAR",
      architecture_status: "APPROVED",
      evidence_status: "VERIFIED",
      logic_status: "GREEN",
      security_status: "GREEN",
      experience_status: "GREEN",
    });
    await fs.writeFile(path.join(tempRoot, ".ma", "guidance", "merged.json"), "{}\n");

    await skills.runMaestro({ autoHeal: true, parallel: true });

    const releaseState = await release.loadReleaseState();
    const healedGuidance = JSON.parse(
      await fs.readFile(path.join(tempRoot, ".ma", "guidance", "merged.json"), "utf8"),
    );
    const maestroState = JSON.parse(await fs.readFile(getMaestroStatePath(tempRoot), "utf8"));
    const maestroEvents = await loadMaestroEvents(tempRoot);

    assert.equal(healedGuidance.schemaVersion, "0.1.0");
    assert.equal(releaseState.build_status, "READY");
    assert.equal(maestroState.runtime_tracks.track_heal_sync.status, "COMPLETED");
    assert.equal(
      Array.isArray(maestroState.runtime_tracks.track_heal_sync.repaired_artifacts),
      true,
    );
    assert.equal(
      maestroEvents.some(
        (event) =>
          event.record_type === "healing:attempt" &&
          event.gate === "$maestro" &&
          event.repaired_count >= 1,
      ),
      true,
    );
  });
});

test("maestro parallel mode records detached-track metadata for eligible gated work", async () => {
  await withTempRepo(async (tempRoot) => {
    const { skills, stateSync } = await loadModules();

    await skills.runInit();
    await stateSync.syncStatusUpdates({
      idea_status: "CLEAR",
      architecture_status: "APPROVED",
      evidence_status: "VERIFIED",
      logic_status: "GREEN",
      security_status: "GREEN",
      experience_status: "GREEN",
    });

    await skills.runMaestro({ parallel: true });

    const maestroState = JSON.parse(await fs.readFile(getMaestroStatePath(tempRoot), "utf8"));
    assert.equal(maestroState.runtime_tracks.track_build_sync.active_gate, "$build");
    assert.equal(typeof maestroState.runtime_tracks.track_build_sync.provider, "string");
  });
});

test("alignment sentinel blocks maestro when release state regresses from approved lane decisions", async () => {
  await withTempRepo(async (tempRoot) => {
    const { skills, fsUtils } = await loadModules();

    await skills.runInit();
    await skills.runIdea("Build an alignment-sensitive feature");
    await skills.runArch();

    await fsUtils.writeJson(path.join(tempRoot, ".ma", "release.json"), {
      ...cleanRelease,
      idea_status: "CLEAR",
      architecture_status: "DRAFT",
    });

    await skills.runMaestro();

    const alignmentReport = JSON.parse(
      await fs.readFile(path.join(tempRoot, ".ma", "state", "alignment-sentinel.json"), "utf8"),
    );
    const maestroPlan = await fs.readFile(
      path.join(tempRoot, ".ma", "plans", "maestro.md"),
      "utf8",
    );
    const maestroState = JSON.parse(await fs.readFile(getMaestroStatePath(tempRoot), "utf8"));
    const decisions = JSON.parse(
      await fs.readFile(path.join(tempRoot, ".ma", "decisions.json"), "utf8"),
    );

    assert.equal(alignmentReport.driftStatus, "DRIFTED");
    assert.equal(alignmentReport.rebootPlanned, true);
    assert.equal(
      alignmentReport.findings.some((finding) => finding.skill === "$arch"),
      true,
    );
    assert.equal(maestroState.runtime_tracks.track_maestro_sync.status, "BLOCKED");
    assert.match(maestroPlan, /Resolve alignment drift before manager dispatch continues/);
    assert.equal(decisions.decisions.at(-1).status, "BLOCKED");
  });
});

test("security lane records package exposure findings and blocks on critical lockfile matches", async () => {
  await withTempRepo(async (tempRoot) => {
    const { skills } = await loadModules();

    await skills.runInit();
    await fs.writeFile(
      path.join(tempRoot, "package-lock.json"),
      `${JSON.stringify(
        {
          name: "fixture",
          lockfileVersion: 3,
          packages: {
            "": {
              name: "fixture",
              version: "1.0.0",
            },
            "node_modules/tar": {
              version: "6.1.11",
            },
          },
        },
        null,
        2,
      )}\n`,
    );

    await skills.runVet();

    const securitySpec = await fs.readFile(
      path.join(tempRoot, ".ma", "specs", "security.md"),
      "utf8",
    );
    const releaseState = JSON.parse(
      await fs.readFile(path.join(tempRoot, ".ma", "release.json"), "utf8"),
    );
    const audits = JSON.parse(
      await fs.readFile(path.join(tempRoot, ".ma", "evidence", "audits.json"), "utf8"),
    );
    const maestroEvents = (await fs.readFile(getMaestroEventsPath(tempRoot), "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));

    assert.equal(releaseState.security_status, "RED");
    assert.match(securitySpec, /tar < 6.2.1 allows arbitrary file overwrite/);
    assert.equal(
      audits.items.some(
        (item) => item.record_type === "finding:package_exposure" && item.package_name === "tar",
      ),
      true,
    );
    assert.equal(
      maestroEvents.some(
        (event) => event.record_type === "finding:package_exposure" && event.package_name === "tar",
      ),
      true,
    );
  });
});

test("non-leader proposals are queued and flow blocks workers without workspaces", async () => {
  await withTempRepo(async (tempRoot) => {
    const { skills, decisions, stateSync, release, fsUtils } = await loadModules();

    await skills.runInit();
    await fsUtils.writeJson(path.join(tempRoot, ".ma", "tasks", "registry.json"), {
      schemaVersion: "0.1.0",
      leader: "captain",
      workers: [],
      tasks: [],
    });

    const proposalDecision = {
      decision: "Worker proposed gate update",
      status: "PROPOSED",
      evidence: [],
      blockers: [],
      next_allowed_triggers: [],
    };

    assert.equal(
      (await decisions.appendDecision(proposalDecision, { actor: "captain" })).proposed,
      false,
    );
    assert.equal(
      (await decisions.appendDecision(proposalDecision, { actor: "worker-1" })).proposed,
      true,
    );
    assert.equal(
      (await stateSync.syncStatusUpdates({ idea_status: "CLEAR" }, { actor: "worker-1" })).proposed,
      true,
    );

    const loadedDecisions = await decisions.loadDecisionLog();
    const loadedRelease = await release.loadReleaseState();
    const mailboxFiles = await fs.readdir(path.join(tempRoot, ".ma", "tasks", "mailbox"));
    assert.equal(loadedDecisions.decisions.length, 1);
    assert.equal(loadedRelease.idea_status, "DRAFT");
    assert.equal(mailboxFiles.length >= 2, true);

    assert.equal((await stateSync.syncStatusUpdates({ idea_status: "CLEAR" })).proposed, false);
    assert.equal(
      (await stateSync.syncStatusUpdates({ evidence_status: "VERIFIED" })).proposed,
      false,
    );

    await fsUtils.writeJson(path.join(tempRoot, ".ma", "tasks", "registry.json"), {
      schemaVersion: "0.1.0",
      leader: "captain",
      workers: ["worker-1"],
      tasks: [],
    });
    await fsUtils.writeJson(path.join(tempRoot, ".ma", "workspaces", "index.json"), {
      schemaVersion: "0.1.0",
      items: [],
    });

    await skills.runFlow();

    const blockedRelease = await release.loadReleaseState();
    const logicSpec = await fs.readFile(path.join(tempRoot, ".ma", "specs", "logic.md"), "utf8");
    assert.equal(blockedRelease.logic_status, "RED");
    assert.match(logicSpec, /Workers exist without registered workspaces/);
    assert.match(logicSpec, /`\$flow`/);
  });
});

test("invalid control-plane state is rejected before lane-side writes", async () => {
  await withTempRepo(async (tempRoot) => {
    const { skills, stateSync, release, fsUtils } = await loadModules();

    await skills.runInit();
    await fs.writeFile(path.join(tempRoot, ".ma", "release.json"), "{not-json");
    await fs.rm(path.join(tempRoot, ".ma", "plans", "maestro.md"), { force: true });
    const originalProjectContext = await fs.readFile(
      path.join(tempRoot, ".ma", "context", "project.md"),
      "utf8",
    );

    await assert.rejects(
      () => skills.runIdea("Corrupt release should not mutate context"),
      /Invalid runtime artifacts: runtime\.release/,
    );
    await assert.rejects(() => skills.runMaestro(), /Invalid runtime artifacts: runtime\.release/);
    await assert.rejects(() => stateSync.syncStatusUpdates({ idea_status: "CLEAR" }));
    assert.equal(
      await fs.readFile(path.join(tempRoot, ".ma", "context", "project.md"), "utf8"),
      originalProjectContext,
    );

    await skills.runInit();
    await fsUtils.writeJson(path.join(tempRoot, ".ma", "release.json"), cleanRelease);
    await fsUtils.writeJson(path.join(tempRoot, ".ma", "decisions.json"), cleanDecisions);
    await stateSync.syncStatusUpdates({ evidence_status: "VERIFIED" });
    await fs.writeFile(path.join(tempRoot, ".ma", "guidance", "merged.json"), "{}\n");
    await skills.runFlow();
    const invalidGuidanceRelease = await release.loadReleaseState();
    const invalidGuidanceLogic = await fs.readFile(
      path.join(tempRoot, ".ma", "specs", "logic.md"),
      "utf8",
    );
    assert.equal(invalidGuidanceRelease.logic_status, "RED");
    assert.match(invalidGuidanceLogic, /Invalid runtime artifacts: guidance\.merged/);

    await skills.runInit();
    await fsUtils.writeJson(path.join(tempRoot, ".ma", "release.json"), cleanRelease);
    await fsUtils.writeJson(path.join(tempRoot, ".ma", "decisions.json"), cleanDecisions);
    await fs.writeFile(path.join(tempRoot, ".ma", "decisions.json"), "{}\n");
    const logicBeforeDecisionFailure = await fs.readFile(
      path.join(tempRoot, ".ma", "specs", "logic.md"),
      "utf8",
    );
    await assert.rejects(() => skills.runFlow(), /Invalid runtime artifacts: runtime\.decisions/);
    await assert.rejects(() => stateSync.syncStatusUpdates({ idea_status: "CLEAR" }));
    assert.equal(
      await fs.readFile(path.join(tempRoot, ".ma", "specs", "logic.md"), "utf8"),
      logicBeforeDecisionFailure,
    );
    assert.equal((await release.loadReleaseState()).idea_status, "DRAFT");
  });
});

test("invalid authority blocks lane writes and direct mutations", async () => {
  await withTempRepo(async (tempRoot) => {
    const { skills, stateSync, fsUtils } = await loadModules();

    await skills.runInit();
    await fsUtils.writeJson(path.join(tempRoot, ".ma", "tasks", "registry.json"), {
      schemaVersion: "0.1.0",
      leader: 42,
      workers: [],
      tasks: [],
    });

    const originalLogicSpec = await fs.readFile(
      path.join(tempRoot, ".ma", "specs", "logic.md"),
      "utf8",
    );
    await assert.rejects(() => skills.runFlow(), /Invalid runtime authority: tasks\.registry/);
    await fs.rm(path.join(tempRoot, ".ma", "plans", "maestro.md"), { force: true });
    await assert.rejects(() => skills.runMaestro(), /Invalid runtime authority: tasks\.registry/);
    await assert.rejects(
      () => stateSync.syncStatusUpdates({ idea_status: "CLEAR" }),
      /Invalid runtime authority: tasks\.registry/,
    );
    assert.equal(
      await fs.readFile(path.join(tempRoot, ".ma", "specs", "logic.md"), "utf8"),
      originalLogicSpec,
    );
  });
});

test("invalid authority blocks architecture writes before mutating the first pillar", async () => {
  await withTempRepo(async (tempRoot) => {
    const { skills, fsUtils } = await loadModules();

    await skills.runInit();
    await skills.runIdea(realisticReleaseHardeningIdea);
    const architectureSpecPath = path.join(tempRoot, ".ma", "specs", "architecture.md");
    const implementationPlanPath = path.join(tempRoot, ".ma", "plans", "implementation.md");
    const originalArchitectureSpec = await fs.readFile(architectureSpecPath, "utf8");
    const originalImplementationPlan = await fs.readFile(implementationPlanPath, "utf8");

    await fsUtils.writeJson(path.join(tempRoot, ".ma", "tasks", "registry.json"), {
      schemaVersion: "0.1.0",
      leader: 42,
      workers: [],
      tasks: [],
    });

    await assert.rejects(() => skills.runArch(), /Invalid runtime authority: tasks\.registry/);
    assert.equal(await fs.readFile(architectureSpecPath, "utf8"), originalArchitectureSpec);
    assert.equal(await fs.readFile(implementationPlanPath, "utf8"), originalImplementationPlan);
  });
});

test("local capability mutation tools do not inherit leader authority", async () => {
  await withTempRepo(async (tempRoot) => {
    const { skills, decisions, release } = await loadModules();
    const stateCapability = await import(
      `${pathToFileURL(path.join(repoRoot, "mcp", "local", "state.js")).href}?t=${Date.now()}`
    );
    const memoryCapability = await import(
      `${pathToFileURL(path.join(repoRoot, "mcp", "local", "memory.js")).href}?t=${Date.now()}`
    );

    await skills.runInit();
    const originalContext = await fs.readFile(
      path.join(tempRoot, ".ma", "context", "project.md"),
      "utf8",
    );

    const stateResult = await stateCapability.callStateTool("state.sync_release_status", {
      idea_status: "CLEAR",
    });
    const decisionResult = await stateCapability.callStateTool("state.append_decision", {
      decision: "Local capability proposal",
      status: "PROPOSED",
      evidence: [],
      blockers: [],
      next_allowed_triggers: [],
    });
    const memoryResult = await memoryCapability.callMemoryTool("memory.store_note", {
      content: "runtime note",
    });

    assert.equal(stateResult.proposed, true);
    assert.equal(decisionResult.proposed, true);
    assert.equal(memoryResult.proposed, true);
    assert.equal((await decisions.loadDecisionLog()).decisions.length, 0);
    assert.equal((await release.loadReleaseState()).idea_status, "DRAFT");
    assert.deepEqual((await loadManagerRuns(tempRoot)).runs, []);
    assert.equal(
      await fs.readFile(path.join(tempRoot, ".ma", "context", "project.md"), "utf8"),
      originalContext,
    );
  });
});

test("team_run local capability remains proposal-only and does not claim coordination ownership", async () => {
  await withTempRepo(async (tempRoot) => {
    const { skills } = await loadModules();
    const teamRunCapability = await import(
      `${pathToFileURL(path.join(repoRoot, "mcp", "local", "team-run.js")).href}?t=${Date.now()}`
    );

    await skills.runInit();

    assert.deepEqual(teamRunCapability.listTeamRunTools(), [
      "team_run.submit_task",
      "team_run.get_status",
      "team_run.list_tasks",
      "team_run.wait_task",
      "team_run.control_task",
    ]);

    const submitResult = await teamRunCapability.callTeamRunTool("team_run.submit_task", {
      title: "verification lane",
    });

    assert.equal(submitResult.proposed, true);
    assert.deepEqual((await loadManagerRuns(tempRoot)).runs, []);

    const registry = JSON.parse(
      await fs.readFile(path.join(tempRoot, ".ma", "tasks", "registry.json"), "utf8"),
    );
    const mailboxFiles = await fs.readdir(path.join(tempRoot, ".ma", "tasks", "mailbox"));

    assert.deepEqual(registry.tasks, []);
    assert.equal(mailboxFiles.length > 0, true);

    const listResult = await teamRunCapability.callTeamRunTool("team_run.list_tasks");
    assert.deepEqual(listResult, []);
  });
});

test("team_run local capability supports bounded task wait and list tools", async () => {
  await withTempRepo(async () => {
    const { skills } = await loadModules();
    const orchestrator = await import(
      `${pathToFileURL(path.join(repoRoot, "src", "runtime", "orchestrator.js")).href}?t=${Date.now()}`
    );
    const teamRunCapability = await import(
      `${pathToFileURL(path.join(repoRoot, "mcp", "local", "team-run.js")).href}?t=${Date.now()}`
    );

    await skills.runInit();
    const submitResult = await orchestrator.submitTask(
      {
        title: "waitable lane",
      },
      { actor: "leader" },
    );

    const tasks = await teamRunCapability.callTeamRunTool("team_run.list_tasks");
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].title, "waitable lane");

    const timeoutResult = await teamRunCapability.callTeamRunTool("team_run.wait_task", {
      taskId: submitResult.task.id,
      timeoutMs: 0,
    });
    assert.equal(timeoutResult.record_type, "team_run_wait_result");
    assert.equal(timeoutResult.terminal, false);
    assert.equal(timeoutResult.timed_out, true);

    await orchestrator.controlTask(submitResult.task.id, "complete", { actor: "leader" });
    const doneResult = await teamRunCapability.callTeamRunTool("team_run.wait_task", {
      taskId: submitResult.task.id,
      timeoutMs: 0,
    });
    assert.equal(doneResult.terminal, true);
    assert.equal(doneResult.timed_out, false);
    assert.equal(doneResult.task.status, "done");
  });
});

test("public _state status updates reject unknown top-level fields", async () => {
  await withTempRepo(async () => {
    const { skills, stateSync } = await loadModules();

    await skills.runInit();

    await assert.rejects(
      () =>
        stateSync.syncStatusUpdates({
          idea_status: "CLEAR",
          arbitrary_field: "should-not-pass",
        }),
      /Unknown release status field\(s\): arbitrary_field/,
    );
  });
});

test("bootstrap and doctor downgrade readiness when runtime artifacts are malformed", async () => {
  await withTempRepo(async (tempRoot) => {
    const { skills, fsUtils, bootstrap } = await loadModules();

    await skills.runInit();
    await fsUtils.writeJson(path.join(tempRoot, ".ma", "release.json"), cleanRelease);
    await fsUtils.writeJson(path.join(tempRoot, ".ma", "decisions.json"), cleanDecisions);
    await fsUtils.writeJson(path.join(tempRoot, ".ma", "tasks", "registry.json"), {
      schemaVersion: "0.1.0",
      leader: "leader",
      workers: [],
      tasks: [],
    });
    await fsUtils.writeJson(path.join(tempRoot, ".ma", "guidance", "merged.json"), {
      schemaVersion: "0.1.0",
      sources: [],
      content: "",
    });

    const codexHome = path.join(tempRoot, "codex-home");
    const codexBin = path.join(tempRoot, "fake-codex-cli");
    await fs.writeFile(
      codexBin,
      `#!/usr/bin/env bash
set -euo pipefail

if [ "\${1:-}" = "--version" ]; then
  echo "codex-cli test"
  exit 0
fi

exit 0
`,
      { mode: 0o755 },
    );
    await fs.chmod(codexBin, 0o755);
    process.env.CODEX_HOME = codexHome;
    process.env.MA_CODEX_BIN = codexBin;

    assert.equal((await bootstrap.runBootstrap()).result, "READY");
    await fs.writeFile(path.join(tempRoot, ".ma", "guidance", "merged.json"), "{}\n");
    assert.equal((await bootstrap.runBootstrap()).result, "READY_WITH_WARNINGS");
    assert.equal((await bootstrap.runDoctor()).result, "READY_WITH_WARNINGS");
  });
});

test("missing release blocks build before rewriting build plan", async () => {
  await withTempRepo(async (tempRoot) => {
    const { skills, spawnPortable } = await loadModules();

    await skills.runInit();
    const buildPlanPath = path.join(tempRoot, ".ma", "plans", "build.md");
    const originalBuildPlan = await fs.readFile(buildPlanPath, "utf8");
    await fs.rm(path.join(tempRoot, ".ma", "release.json"));

    const result = spawnPortable(
      process.execPath,
      [path.join(repoRoot, "bin", "ma.js"), "run", "$build"],
      {
        cwd: tempRoot,
        env: { ...process.env, MA_ROOT: tempRoot },
        encoding: "utf8",
      },
    );

    assert.equal(result.status, 1);
    assert.equal(await fs.readFile(buildPlanPath, "utf8"), originalBuildPlan);
  });
});

test("runtime-aware build readiness points to repair and maestro mirrors that routing", async () => {
  await withTempRepo(async (tempRoot) => {
    const { skills, fsUtils, release, buildReadiness, runtimeState } = await loadModules();

    await skills.runInit();
    await skills.runIdea(
      "Harden Meta-Architect runtime readiness with semantic artifacts and repair routing",
    );
    await fsUtils.writeJson(path.join(tempRoot, ".ma", "release.json"), {
      ...cleanRelease,
      idea_status: "CLEAR",
      architecture_status: "APPROVED",
      evidence_status: "VERIFIED",
      logic_status: "GREEN",
      security_status: "GREEN",
      experience_status: "GREEN",
    });
    await fs.writeFile(path.join(tempRoot, ".ma", "guidance", "merged.json"), "{}\n");

    const runtimeSnapshot = await runtimeState.loadRuntimeSnapshot();
    const runtimeSummary = runtimeState.createRuntimeSummary(runtimeSnapshot);
    const readiness = buildReadiness.evaluateRuntimeBuildReadiness(
      await release.loadReleaseState(),
      runtimeSummary,
    );

    assert.equal(readiness.allowed, false);
    assert.deepEqual(readiness.nextTriggers, ["repair runtime artifacts"]);

    await skills.runMaestro();
    const maestroPlan = await fs.readFile(
      path.join(tempRoot, ".ma", "plans", "maestro.md"),
      "utf8",
    );
    assert.match(maestroPlan, /repair runtime artifacts/);
    assert.doesNotMatch(maestroPlan, /Unlock bounded implementation planning/);
  });
});

test("runtime-aware build readiness routes back to $vet when critical package exposure exists", async () => {
  await withTempRepo(async (tempRoot) => {
    const { skills, fsUtils, release, buildReadiness, runtimeState } = await loadModules();

    await skills.runInit();
    await skills.runIdea(
      "Harden Meta-Architect package exposure readiness with release-blocking security routing",
    );
    await fsUtils.writeJson(path.join(tempRoot, ".ma", "release.json"), {
      ...cleanRelease,
      idea_status: "CLEAR",
      architecture_status: "APPROVED",
      evidence_status: "VERIFIED",
      logic_status: "GREEN",
      security_status: "GREEN",
      experience_status: "GREEN",
    });
    await fsUtils.writeJson(path.join(tempRoot, ".ma", "evidence", "audits.json"), {
      schemaVersion: "0.1.0",
      items: [
        {
          record_type: "finding:package_exposure",
          severity: "critical",
          package_name: "tar",
          package_version: "6.1.11",
        },
      ],
    });

    const runtimeSnapshot = await runtimeState.loadRuntimeSnapshot();
    const runtimeSummary = runtimeState.createRuntimeSummary(runtimeSnapshot);
    const readiness = buildReadiness.evaluateRuntimeBuildReadiness(
      await release.loadReleaseState(),
      runtimeSummary,
    );

    assert.equal(readiness.allowed, false);
    assert.deepEqual(readiness.nextTriggers, ["$vet"]);
  });
});

test("runtime-aware build readiness blocks on pending release issue gates only in release mode", async () => {
  await withTempRepo(async (tempRoot) => {
    const { skills, fsUtils, release, buildReadiness, runtimeState } = await loadModules();

    await skills.runInit();
    await skills.runIdea(
      "Harden Meta-Architect issue-gated release readiness with production proof enforcement",
    );
    await fsUtils.writeJson(path.join(tempRoot, ".ma", "release.json"), {
      ...cleanRelease,
      idea_status: "CLEAR",
      architecture_status: "APPROVED",
      evidence_status: "VERIFIED",
      logic_status: "GREEN",
      security_status: "GREEN",
      experience_status: "GREEN",
    });
    await fs.mkdir(path.join(tempRoot, "docs", "qa"), { recursive: true });
    await fsUtils.writeJson(path.join(tempRoot, "docs", "qa", "release-issue-gates-0.1.13.json"), {
      schemaVersion: "1.0.0",
      releaseVersion: "0.1.13",
      releaseTag: "v0.1.13",
      passContract: {
        allIssuesMustPassProduction: true,
      },
      issues: [
        {
          number: 14,
          title: "Pending issue gate",
          url: "https://github.com/JustineDevs/meta-architect/issues/14",
          releaseVersion: "0.1.13",
          releaseTag: "v0.1.13",
          milestone: "v0.1.13",
          status: "pending",
          requiredProof: ["implementation", "verification", "production"],
          loopAction: "Implement missing issue work.",
          proof: {
            implementationEvidence: [],
            verificationEvidence: [],
            productionEvidence: [],
          },
        },
      ],
    });

    const runtimeSnapshot = await runtimeState.loadRuntimeSnapshot();
    const runtimeSummary = runtimeState.createRuntimeSummary(runtimeSnapshot);
    const defaultReadiness = buildReadiness.evaluateRuntimeBuildReadiness(
      await release.loadReleaseState(),
      runtimeSummary,
    );
    const readiness = buildReadiness.evaluateRuntimeBuildReadiness(
      await release.loadReleaseState(),
      runtimeSummary,
      { enforceIssueGates: true },
    );

    assert.equal(defaultReadiness.allowed, true);
    assert.equal(readiness.allowed, false);
    assert.deepEqual(readiness.nextTriggers, ["implement release issue gates"]);
  });
});
