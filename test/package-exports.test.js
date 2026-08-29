import assert from "node:assert/strict";
import test from "node:test";
import {
  agentRegistry,
  chooseHelperRoute,
  classifyAutonomyBranch,
  createAlignmentRecoveryPlan,
  createCodeGraphTouchpointFromFile,
  createContextEconomyPayload,
  createContextEconomyView,
  createDefaultEnvironmentAwarenessCore,
  createDefaultHelperOrchestrationCore,
  createDefaultObsidianPluginBridgeManifest,
  createDefaultUniversalPluginBrokerCore,
  createDiscoveredEnvironmentAwarenessCore,
  createHelperReceipt,
  createLearningRecord,
  createMcpDescriptorEconomy,
  createObsidianSelectionContext,
  createObsidianVaultSnapshotExport,
  createQuorumReviewReceipt,
  createRalphIterationPlan,
  createRalphPrdContract,
  createSemanticReceipt,
  createSkillCompatibilityPayload,
  createSkillLockEntry,
  createUniversalPluginManifest,
  createVirtualVerificationReceipt,
  detectInstalledPluginHosts,
  detectPassivePermissionHandoff,
  discoverEnvironmentCapabilities,
  ensureObsidianGraphLinks,
  evaluateHelperCoreCoverage,
  evaluateWorkspaceEffectiveness,
  helperSkillNames,
  indexObsidianVault,
  inspectSkillCompatibilityInstall,
  installObsidianPlugin,
  installUniversalPlugin,
  learningLoopDomains,
  quorumDecisions,
  redactProviderBoundPayload,
  renderUniversalMcpServerTemplate,
  resolvePromptStrategyForRole,
  resolvePromptStrategyForSurface,
  runLocalCapabilityReadinessChecks,
  scanExposureProfile,
  selectEnvironmentCapabilitiesForTask,
  validateEnvironmentAwarenessCore,
  validateHelperOrchestrationCore,
  validateRuntimeMcpPolicy,
  validateSkillLockEntry,
  validateUniversalPluginBrokerCore,
  validateUniversalPluginManifest,
  verifyCrossAgentInstallMatrix,
  verifyLiveAgentMatrix,
  writeObsidianAttachment,
  writeObsidianVaultIndex,
  writeSkillCompatibilityExport,
} from "../index.js";

test("package entrypoint exposes MA core runtime capabilities", () => {
  const requiredFunctions = [
    classifyAutonomyBranch,
    createAlignmentRecoveryPlan,
    createCodeGraphTouchpointFromFile,
    createContextEconomyView,
    createContextEconomyPayload,
    createDefaultEnvironmentAwarenessCore,
    createDefaultUniversalPluginBrokerCore,
    createDefaultObsidianPluginBridgeManifest,
    createDefaultHelperOrchestrationCore,
    createDiscoveredEnvironmentAwarenessCore,
    discoverEnvironmentCapabilities,
    createHelperReceipt,
    createLearningRecord,
    createMcpDescriptorEconomy,
    createObsidianSelectionContext,
    createObsidianVaultSnapshotExport,
    ensureObsidianGraphLinks,
    indexObsidianVault,
    installObsidianPlugin,
    createQuorumReviewReceipt,
    createRalphIterationPlan,
    createRalphPrdContract,
    createSemanticReceipt,
    createSkillCompatibilityPayload,
    createSkillLockEntry,
    createUniversalPluginManifest,
    createVirtualVerificationReceipt,
    detectPassivePermissionHandoff,
    detectInstalledPluginHosts,
    evaluateHelperCoreCoverage,
    evaluateWorkspaceEffectiveness,
    inspectSkillCompatibilityInstall,
    installUniversalPlugin,
    redactProviderBoundPayload,
    renderUniversalMcpServerTemplate,
    chooseHelperRoute,
    resolvePromptStrategyForSurface,
    resolvePromptStrategyForRole,
    runLocalCapabilityReadinessChecks,
    scanExposureProfile,
    selectEnvironmentCapabilitiesForTask,
    validateEnvironmentAwarenessCore,
    validateRuntimeMcpPolicy,
    validateHelperOrchestrationCore,
    validateSkillLockEntry,
    validateUniversalPluginBrokerCore,
    validateUniversalPluginManifest,
    verifyCrossAgentInstallMatrix,
    verifyLiveAgentMatrix,
    writeObsidianVaultIndex,
    writeObsidianAttachment,
    writeSkillCompatibilityExport,
  ];

  for (const exportedFunction of requiredFunctions) {
    assert.equal(typeof exportedFunction, "function");
  }

  assert.equal(typeof agentRegistry, "object");
  assert.deepEqual(helperSkillNames, ["$align", "$diagnose", "$tdd", "$cleanup"]);
  assert.equal(Array.isArray(learningLoopDomains), true);
  assert.equal(typeof quorumDecisions, "object");
});

test("live agent verification separates runtime evidence from distribution evidence", async () => {
  const report = await verifyLiveAgentMatrix({ targets: Object.keys(agentRegistry) });
  assert.equal(report.target_count, 55);
  assert.equal(report.results.length, 55);
  assert.equal(
    report.results.every((result) =>
      ["runtime-verified", "distribution-only", "blocked"].includes(result.status),
    ),
    true,
  );
  assert.equal(report.production_evidence, false);
});
