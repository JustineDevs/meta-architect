import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { readJson, writeJson } from "../fs-utils.js";
import { getRepoRoot, getRuntimeReadPath } from "../paths.js";
import {
  resolveReleaseIssueGates,
  summarizeReleaseIssueGateStatus,
} from "../release-issue-gates.js";
import { createDefaultReleaseState, validateReleaseState } from "../release-state.js";
import {
  createDefaultActiveAutonomyCore,
  getActiveAutonomyCorePath,
  seedActiveAutonomyCoreArtifacts,
  validateActiveAutonomyCore,
} from "./active-autonomy-core.js";
import { seedAlignmentSentinelArtifacts } from "./alignment-sentinel.js";
import { seedArchitectReviewArtifacts } from "./architect-review.js";
import {
  createDefaultCodeGraphRehearse,
  getCodeGraphRehearsePath,
  seedCodeGraphRehearseArtifacts,
  validateCodeGraphRehearse,
} from "./code-graph-rehearse.js";
import {
  createDefaultCodeburnUsage,
  getCodeburnLogPath,
  seedCodeburnArtifacts,
} from "./codeburn-core.js";
import {
  createDefaultContextEconomyCore,
  getContextEconomyCorePath,
  seedContextEconomyCoreArtifacts,
  validateContextEconomyCore,
} from "./context-economy-core.js";
import {
  createDefaultContinuityGraph,
  getContinuityGraphPath,
  validateContinuityGraph,
} from "./continuity-graph.js";
import {
  getContinuityIndexPath,
  getContinuityNotesPath,
  seedContinuityArtifacts,
} from "./continuity-notes.js";
import {
  createDefaultCoreSourceIngest,
  getCoreSourceIngestPath,
  seedCoreSourceIngestArtifacts,
  validateCoreSourceIngest,
} from "./core-source-ingest.js";
import {
  createDefaultEnvironmentAwarenessCore,
  getEnvironmentAwarenessCorePath,
  seedEnvironmentAwarenessCoreArtifacts,
  validateEnvironmentAwarenessCore,
} from "./environment-awareness-core.js";
import {
  createDefaultGraphifyIndex,
  getGraphifyIndexPath,
  seedGraphifyArtifacts,
  validateGraphifyIndex,
} from "./graphify-core.js";
import {
  getGuidanceIncludeGraphPath,
  getMergedGuidancePath,
  seedGuidanceStackArtifacts,
} from "./guidance-stack.js";
import { seedHeadroomArtifacts } from "./headroom-core.js";
import {
  createDefaultHelperOrchestrationCore,
  getHelperOrchestrationCorePath,
  seedHelperOrchestrationCoreArtifacts,
  validateHelperOrchestrationCore,
} from "./helper-orchestration-core.js";
import {
  createDefaultLearningLoopCore,
  getLearningLoopCorePath,
  seedLearningLoopCoreArtifacts,
  validateLearningLoopCore,
} from "./learning-loop-core.js";
import { getManagerRunsPath, seedMaestroManagerArtifacts } from "./maestro-manager.js";
import {
  createDefaultMaestroState,
  getMaestroStatePath,
  seedMaestroStateArtifacts,
} from "./maestro-state.js";
import {
  createDefaultObsidianBridge,
  createDefaultObsidianVaultIndex,
  createDefaultObsidianVaultOperations,
  getObsidianBridgePath,
  getObsidianVaultIndexPath,
  getObsidianVaultOperationsPath,
  seedObsidianBridgeArtifacts,
  validateObsidianBridge,
  validateObsidianVaultIndex,
  validateObsidianVaultOperations,
} from "./obsidian-integration-core.js";
import {
  getTaskLockRoot,
  getTaskMailboxRoot,
  getTaskRegistryPath,
  seedOrchestratorArtifacts,
} from "./orchestrator.js";
import {
  createDefaultPromptStrategyCore,
  getPromptStrategyCorePath,
  seedPromptStrategyCoreArtifacts,
  validatePromptStrategyCore,
} from "./prompt-strategy-core.js";
import {
  createDefaultSemanticRecordingCore,
  getSemanticRecordingCorePath,
  seedSemanticRecordingCoreArtifacts,
  validateSemanticRecordingCore,
} from "./semantic-recording-core.js";
import {
  getRuntimeHooksAuditPath,
  getRuntimeHooksConfigPath,
  seedSignalHookArtifacts,
} from "./signal-hooks.js";
import {
  createDefaultSkillsRegistryExport,
  getSkillsRegistryExportPath,
  seedSkillsRegistryExportArtifacts,
  validateSkillsRegistryExport,
} from "./skills-registry-export.js";
import {
  createDefaultUniversalPluginBrokerCore,
  getUniversalPluginBrokerCorePath,
  seedUniversalPluginBrokerCoreArtifacts,
  validateUniversalPluginBrokerCore,
} from "./universal-plugin-broker-core.js";
import {
  createDefaultCapabilityComposition,
  createDefaultSemanticReceiptIndex,
  createDefaultWorkspaceContextPack,
  createDefaultWorkspaceEffectiveness,
  getCapabilityCompositionPath,
  getSemanticReceiptIndexPath,
  getWorkspaceContextPackPath,
  getWorkspaceEffectivenessPath,
  seedWorkspaceIntelligenceArtifacts,
  validateCapabilityComposition,
  validateSemanticReceiptIndex,
  validateWorkspaceContextPack,
  validateWorkspaceEffectiveness,
} from "./workspace-intelligence-runtime.js";
import {
  createDefaultWorkspaceVirtualizer,
  getWorkspaceVirtualizerPath,
  seedWorkspaceVirtualizerArtifacts,
  validateWorkspaceVirtualizer,
} from "./workspace-virtualizer.js";
import { getWorkspacesIndexPath, seedWorkspaceArtifacts } from "./workspaces.js";

const runtimeSubsystemSeeders = [
  seedGuidanceStackArtifacts,
  seedGraphifyArtifacts,
  seedContinuityArtifacts,
  seedSignalHookArtifacts,
  seedOrchestratorArtifacts,
  seedWorkspaceArtifacts,
  seedMaestroManagerArtifacts,
  seedMaestroStateArtifacts,
  seedArchitectReviewArtifacts,
  seedAlignmentSentinelArtifacts,
  seedSemanticRecordingCoreArtifacts,
  seedHelperOrchestrationCoreArtifacts,
  seedHeadroomArtifacts,
  seedLearningLoopCoreArtifacts,
  seedWorkspaceIntelligenceArtifacts,
  seedPromptStrategyCoreArtifacts,
  seedActiveAutonomyCoreArtifacts,
  seedContextEconomyCoreArtifacts,
  seedEnvironmentAwarenessCoreArtifacts,
  seedCoreSourceIngestArtifacts,
  seedUniversalPluginBrokerCoreArtifacts,
  seedObsidianBridgeArtifacts,
  seedWorkspaceVirtualizerArtifacts,
  seedCodeGraphRehearseArtifacts,
  seedCodeburnArtifacts,
  seedSkillsRegistryExportArtifacts,
];
const defaultMergedGuidance = {
  schemaVersion: "0.1.0",
  sources: [],
  content: "",
};
const defaultGuidanceGraph = {
  schemaVersion: "0.1.0",
  roots: [],
  edges: [],
};
const defaultContinuityIndex = {
  schemaVersion: "0.1.0",
  sessionCount: 0,
  lastUpdatedAt: null,
};
const defaultHookConfig = {
  schemaVersion: "0.1.0",
  compatibilityNamespace: ["prebuild", "prerelease"],
  runtimeNamespace: [
    "prompt_submit",
    "pre_action",
    "post_action",
    "failure",
    "session_start",
    "cwd_changed",
    "file_changed",
    "workspace_created",
  ],
  hooks: [],
  activeAutonomy: {
    enabled: true,
    stopPolicy: "block_passive_permission_handoff_when_auto_continue_applies",
    defaultResponse:
      "AUTO-CONTINUE: continue the current safe branch, execute the next reversible step, then verify before reporting.",
    stallPatterns: [
      "should i proceed",
      "would you like me to continue",
      "if you want, i can",
      "if you'd like, i can",
      "tell me if you want me to",
      "i can continue if you want",
      "let me know if you want me to continue",
    ],
  },
};
const defaultTaskRegistry = {
  schemaVersion: "0.1.0",
  leader: "leader",
  workers: [],
  tasks: [],
};
const defaultWorkspaceIndex = {
  schemaVersion: "0.1.0",
  items: [],
};
const defaultDecisions = {
  schemaVersion: "0.1.0",
  decisions: [],
};
const defaultAudits = {
  schemaVersion: "0.1.0",
  items: [],
};
const defaultCves = {
  schemaVersion: "0.1.0",
  items: [],
};
const defaultReleaseIssueGates = {
  schemaVersion: "1.0.0",
  releaseVersion: "0.0.0",
  releaseTag: "v0.0.0",
  passContract: {
    allIssuesMustPassProduction: true,
    allIssuesMustHaveLabels: true,
  },
  issues: [],
};
const defaultManagerRuns = {
  schemaVersion: "0.1.0",
  runs: [],
};
const defaultMaestroState = createDefaultMaestroState();
const defaultActiveAutonomyCore = createDefaultActiveAutonomyCore();
const defaultSemanticRecordingCore = createDefaultSemanticRecordingCore();
const defaultHelperOrchestrationCore = createDefaultHelperOrchestrationCore();
const defaultLearningLoopCore = createDefaultLearningLoopCore();
const defaultPromptStrategyCore = createDefaultPromptStrategyCore();
const defaultContextEconomyCore = createDefaultContextEconomyCore();
const defaultEnvironmentAwarenessCore = createDefaultEnvironmentAwarenessCore();
const defaultCoreSourceIngest = createDefaultCoreSourceIngest();
const defaultUniversalPluginBrokerCore = createDefaultUniversalPluginBrokerCore();
const defaultObsidianBridge = createDefaultObsidianBridge();
const defaultObsidianVaultIndex = createDefaultObsidianVaultIndex();
const defaultObsidianVaultOperations = createDefaultObsidianVaultOperations();
const defaultWorkspaceVirtualizer = createDefaultWorkspaceVirtualizer();
const defaultCodeGraphRehearse = createDefaultCodeGraphRehearse();
const defaultCodeburnUsage = createDefaultCodeburnUsage();
const defaultSkillsRegistryExport = createDefaultSkillsRegistryExport();
const defaultCapabilityComposition = createDefaultCapabilityComposition();
const defaultWorkspaceContextPack = createDefaultWorkspaceContextPack();
const defaultWorkspaceEffectiveness = createDefaultWorkspaceEffectiveness();
const defaultSemanticReceiptIndex = createDefaultSemanticReceiptIndex();
const defaultContinuityGraph = createDefaultContinuityGraph();
const terminalManagerStates = new Set(["completed", "blocked", "failed", "cancelled"]);
const repairableRuntimeArtifacts = new Set([
  "guidance.merged",
  "guidance.includeGraph",
  "context.activeAutonomyCore",
  "context.recordingCore",
  "context.helperOrchestrationCore",
  "context.learningLoopCore",
  "context.promptStrategyCore",
  "context.contextEconomyCore",
  "context.environmentAwarenessCore",
  "context.coreSourceIngest",
  "context.universalPluginBrokerCore",
  "context.obsidianBridge",
  "context.obsidianVaultOperations",
  "context.workspaceVirtualizer",
  "context.codeGraphRehearse",
  "context.skillsRegistryExport",
  "context.capabilityComposition",
  "context.workspaceContextPack",
  "context.workspaceEffectiveness",
  "evidence.semanticReceipts",
  "memory.index",
  "memory.graph",
  "hooks.config",
  "tasks.registry",
  "workspaces.index",
  "runtime.managerRuns",
  "runtime.maestroState",
]);

function coerceValidated(value, fallback, label, predicate, invalidArtifacts) {
  if (predicate(value)) {
    return value;
  }

  invalidArtifacts.push(label);
  return fallback;
}

export async function ensureRuntimeSubsystems() {
  for (const seedRuntimeSubsystem of runtimeSubsystemSeeders) {
    await seedRuntimeSubsystem();
  }
}

function getMailboxProposalPath(kind) {
  return path.join(getTaskMailboxRoot(), `${Date.now()}-${kind}-${randomUUID()}.json`);
}

export function isLeaderActor(actor = "leader") {
  return actor === "leader";
}

export async function loadLeaderAuthority() {
  try {
    const registry = await readJson(getTaskRegistryPath());
    const isValidRegistry =
      registry &&
      typeof registry === "object" &&
      typeof registry.leader === "string" &&
      Array.isArray(registry.workers) &&
      Array.isArray(registry.tasks);

    if (!isValidRegistry) {
      return { state: "invalid", leaderActor: null };
    }

    return { state: "ok", leaderActor: registry.leader };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { state: "missing", leaderActor: "leader" };
    }

    return { state: "invalid", leaderActor: null };
  }
}

export async function assertLeaderAuthority(actor) {
  const authority = await loadLeaderAuthority();
  if (authority.state === "invalid") {
    throw new Error("Invalid runtime authority: tasks.registry");
  }

  const leaderActor = authority.leaderActor ?? "leader";
  const effectiveActor = actor ?? leaderActor;
  if (effectiveActor !== leaderActor) {
    throw new Error("Leader authority required");
  }

  return authority;
}

export async function queueMailboxProposal({ actor, kind, payload }) {
  const proposal = {
    schemaVersion: "0.1.0",
    actor,
    kind,
    payload,
    proposedAt: new Date().toISOString(),
  };
  const target = getMailboxProposalPath(kind);
  await writeJson(target, proposal);
  return target;
}

export async function guardLeaderMutation({ actor, kind, payload }) {
  const authority = await loadLeaderAuthority();
  if (authority.state === "invalid") {
    throw new Error("Invalid runtime authority: tasks.registry");
  }
  const leaderActor = authority.leaderActor ?? "leader";
  const effectiveActor = actor ?? leaderActor;
  if (effectiveActor === leaderActor) {
    return { allowed: true, proposalPath: null };
  }

  const proposalPath = await queueMailboxProposal({ actor: effectiveActor, kind, payload });
  return { allowed: false, proposalPath };
}

export async function loadRuntimeSnapshot() {
  const missingArtifacts = [];
  const invalidArtifacts = [];
  const readJsonWithStatus = async (filePath, fallback, label) => {
    try {
      return await readJson(filePath);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        missingArtifacts.push(label);
      } else {
        invalidArtifacts.push(label);
      }
      return fallback;
    }
  };
  const readTextWithStatus = async (filePath, fallback, label) => {
    try {
      return await fs.readFile(filePath, "utf8");
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        missingArtifacts.push(label);
      } else {
        invalidArtifacts.push(label);
      }
      return fallback;
    }
  };
  const mailboxEntries = await fs.readdir(getTaskMailboxRoot()).catch(() => {
    missingArtifacts.push("tasks.mailbox");
    return [];
  });
  await fs.access(getRuntimeHooksAuditPath()).catch(() => {
    missingArtifacts.push("hooks.audit");
  });
  await fs.access(getTaskLockRoot()).catch(() => {
    missingArtifacts.push("tasks.locks");
  });
  const releaseIssueGatesResolution = resolveReleaseIssueGates(getRepoRoot());
  if (!releaseIssueGatesResolution) {
    missingArtifacts.push("release.issueGates");
  }

  const [
    mergedGuidance,
    guidanceGraph,
    graphifyIndex,
    continuityIndex,
    continuityGraph,
    continuityNotes,
    hookConfig,
    taskRegistry,
    workspaceIndex,
    release,
    decisions,
    audits,
    cves,
    releaseIssueGates,
    managerRuns,
    maestroState,
    activeAutonomyCore,
    semanticRecordingCore,
    helperOrchestrationCore,
    learningLoopCore,
    promptStrategyCore,
    contextEconomyCore,
    environmentAwarenessCore,
    coreSourceIngest,
    universalPluginBrokerCore,
    obsidianBridge,
    obsidianVaultIndex,
    obsidianVaultOperations,
    workspaceVirtualizer,
    codeGraphRehearse,
    codeburnUsage,
    skillsRegistryExport,
    capabilityComposition,
    workspaceContextPack,
    workspaceEffectiveness,
    semanticReceiptIndex,
  ] = await Promise.all([
    readJsonWithStatus(getMergedGuidancePath(), defaultMergedGuidance, "guidance.merged"),
    readJsonWithStatus(
      getGuidanceIncludeGraphPath(),
      defaultGuidanceGraph,
      "guidance.includeGraph",
    ),
    readJsonWithStatus(getGraphifyIndexPath(), createDefaultGraphifyIndex(), "context.graphify"),
    readJsonWithStatus(getContinuityIndexPath(), defaultContinuityIndex, "memory.index"),
    readJsonWithStatus(getContinuityGraphPath(), defaultContinuityGraph, "memory.graph"),
    readTextWithStatus(getContinuityNotesPath(), "", "memory.notes"),
    readJsonWithStatus(getRuntimeHooksConfigPath(), defaultHookConfig, "hooks.config"),
    readJsonWithStatus(getTaskRegistryPath(), defaultTaskRegistry, "tasks.registry"),
    readJsonWithStatus(getWorkspacesIndexPath(), defaultWorkspaceIndex, "workspaces.index"),
    (async () => {
      try {
        return validateReleaseState(
          JSON.parse(await fs.readFile(getRuntimeReadPath("release.json"), "utf8")),
        );
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
          missingArtifacts.push("runtime.release");
        } else {
          invalidArtifacts.push("runtime.release");
        }

        return createDefaultReleaseState();
      }
    })(),
    readJsonWithStatus(getRuntimeReadPath("decisions.json"), defaultDecisions, "runtime.decisions"),
    readJsonWithStatus(
      getRuntimeReadPath("evidence", "audits.json"),
      defaultAudits,
      "runtime.audits",
    ),
    readJsonWithStatus(getRuntimeReadPath("evidence", "cves.json"), defaultCves, "runtime.cves"),
    readJsonWithStatus(
      releaseIssueGatesResolution?.path ??
        path.join(getRepoRoot(), "docs", "qa", "release-issue-gates-missing.json"),
      defaultReleaseIssueGates,
      "release.issueGates",
    ),
    readJsonWithStatus(getManagerRunsPath(), defaultManagerRuns, "runtime.managerRuns"),
    readJsonWithStatus(getMaestroStatePath(), defaultMaestroState, "runtime.maestroState"),
    readJsonWithStatus(
      getActiveAutonomyCorePath(),
      defaultActiveAutonomyCore,
      "context.activeAutonomyCore",
    ),
    readJsonWithStatus(
      getSemanticRecordingCorePath(),
      defaultSemanticRecordingCore,
      "context.recordingCore",
    ),
    readJsonWithStatus(
      getHelperOrchestrationCorePath(),
      defaultHelperOrchestrationCore,
      "context.helperOrchestrationCore",
    ),
    readJsonWithStatus(
      getLearningLoopCorePath(),
      defaultLearningLoopCore,
      "context.learningLoopCore",
    ),
    readJsonWithStatus(
      getPromptStrategyCorePath(),
      defaultPromptStrategyCore,
      "context.promptStrategyCore",
    ),
    readJsonWithStatus(
      getContextEconomyCorePath(),
      defaultContextEconomyCore,
      "context.contextEconomyCore",
    ),
    readJsonWithStatus(
      getEnvironmentAwarenessCorePath(),
      defaultEnvironmentAwarenessCore,
      "context.environmentAwarenessCore",
    ),
    readJsonWithStatus(
      getCoreSourceIngestPath(),
      defaultCoreSourceIngest,
      "context.coreSourceIngest",
    ),
    readJsonWithStatus(
      getUniversalPluginBrokerCorePath(),
      defaultUniversalPluginBrokerCore,
      "context.universalPluginBrokerCore",
    ),
    readJsonWithStatus(getObsidianBridgePath(), defaultObsidianBridge, "context.obsidianBridge"),
    readJsonWithStatus(
      getObsidianVaultIndexPath(),
      defaultObsidianVaultIndex,
      "context.obsidianVaultIndex",
    ),
    readJsonWithStatus(
      getObsidianVaultOperationsPath(),
      defaultObsidianVaultOperations,
      "context.obsidianVaultOperations",
    ),
    readJsonWithStatus(
      getWorkspaceVirtualizerPath(),
      defaultWorkspaceVirtualizer,
      "context.workspaceVirtualizer",
    ),
    readJsonWithStatus(
      getCodeGraphRehearsePath(),
      defaultCodeGraphRehearse,
      "context.codeGraphRehearse",
    ),
    readJsonWithStatus(getCodeburnLogPath(), defaultCodeburnUsage, "context.codeburnUsage"),
    readJsonWithStatus(
      getSkillsRegistryExportPath(),
      defaultSkillsRegistryExport,
      "context.skillsRegistryExport",
    ),
    readJsonWithStatus(
      getCapabilityCompositionPath(),
      defaultCapabilityComposition,
      "context.capabilityComposition",
    ),
    readJsonWithStatus(
      getWorkspaceContextPackPath(),
      defaultWorkspaceContextPack,
      "context.workspaceContextPack",
    ),
    readJsonWithStatus(
      getWorkspaceEffectivenessPath(),
      defaultWorkspaceEffectiveness,
      "context.workspaceEffectiveness",
    ),
    readJsonWithStatus(
      getSemanticReceiptIndexPath(),
      defaultSemanticReceiptIndex,
      "evidence.semanticReceipts",
    ),
  ]);
  const validatedMergedGuidance = coerceValidated(
    mergedGuidance,
    defaultMergedGuidance,
    "guidance.merged",
    (value) =>
      value &&
      typeof value === "object" &&
      Array.isArray(value.sources) &&
      typeof value.content === "string",
    invalidArtifacts,
  );
  const validatedGuidanceGraph = coerceValidated(
    guidanceGraph,
    defaultGuidanceGraph,
    "guidance.includeGraph",
    (value) =>
      value &&
      typeof value === "object" &&
      Array.isArray(value.roots) &&
      Array.isArray(value.edges),
    invalidArtifacts,
  );
  const validatedGraphifyIndex = coerceValidated(
    graphifyIndex,
    createDefaultGraphifyIndex(),
    "context.graphify",
    (value) => {
      try {
        validateGraphifyIndex(value);
        return true;
      } catch {
        return false;
      }
    },
    invalidArtifacts,
  );
  const validatedContinuityIndex = coerceValidated(
    continuityIndex,
    defaultContinuityIndex,
    "memory.index",
    (value) =>
      value &&
      typeof value === "object" &&
      typeof value.sessionCount === "number" &&
      "lastUpdatedAt" in value,
    invalidArtifacts,
  );
  const validatedContinuityGraph = coerceValidated(
    continuityGraph,
    defaultContinuityGraph,
    "memory.graph",
    (value) => {
      try {
        validateContinuityGraph(value);
        return true;
      } catch {
        return false;
      }
    },
    invalidArtifacts,
  );
  const validatedHookConfig = coerceValidated(
    hookConfig,
    defaultHookConfig,
    "hooks.config",
    (value) =>
      value &&
      typeof value === "object" &&
      Array.isArray(value.compatibilityNamespace) &&
      Array.isArray(value.runtimeNamespace) &&
      Array.isArray(value.hooks) &&
      value.activeAutonomy &&
      typeof value.activeAutonomy === "object" &&
      value.activeAutonomy.enabled === true &&
      Array.isArray(value.activeAutonomy.stallPatterns),
    invalidArtifacts,
  );
  const validatedTaskRegistry = coerceValidated(
    taskRegistry,
    defaultTaskRegistry,
    "tasks.registry",
    (value) =>
      value &&
      typeof value === "object" &&
      typeof value.leader === "string" &&
      Array.isArray(value.workers) &&
      Array.isArray(value.tasks),
    invalidArtifacts,
  );
  const validatedWorkspaceIndex = coerceValidated(
    workspaceIndex,
    defaultWorkspaceIndex,
    "workspaces.index",
    (value) => value && typeof value === "object" && Array.isArray(value.items),
    invalidArtifacts,
  );
  const validatedDecisions = coerceValidated(
    decisions,
    defaultDecisions,
    "runtime.decisions",
    (value) => value && typeof value === "object" && Array.isArray(value.decisions),
    invalidArtifacts,
  );
  const validatedAudits = coerceValidated(
    audits,
    defaultAudits,
    "runtime.audits",
    (value) => value && typeof value === "object" && Array.isArray(value.items),
    invalidArtifacts,
  );
  const validatedCves = coerceValidated(
    cves,
    defaultCves,
    "runtime.cves",
    (value) => value && typeof value === "object" && Array.isArray(value.items),
    invalidArtifacts,
  );
  const releaseIssueGateStatus = summarizeReleaseIssueGateStatus(releaseIssueGates, {
    version: releaseIssueGates.releaseVersion,
  });
  const validatedManagerRuns = coerceValidated(
    managerRuns,
    defaultManagerRuns,
    "runtime.managerRuns",
    (value) => value && typeof value === "object" && Array.isArray(value.runs),
    invalidArtifacts,
  );
  const validatedMaestroState = coerceValidated(
    maestroState,
    defaultMaestroState,
    "runtime.maestroState",
    (value) =>
      value &&
      typeof value === "object" &&
      typeof value.global_status === "string" &&
      value.runtime_tracks &&
      typeof value.runtime_tracks === "object" &&
      value.downstream_lock_table &&
      typeof value.downstream_lock_table === "object",
    invalidArtifacts,
  );
  const validatedActiveAutonomyCore = coerceValidated(
    activeAutonomyCore,
    defaultActiveAutonomyCore,
    "context.activeAutonomyCore",
    (value) => {
      try {
        validateActiveAutonomyCore(value);
        return true;
      } catch {
        return false;
      }
    },
    invalidArtifacts,
  );
  const validatedSemanticRecordingCore = coerceValidated(
    semanticRecordingCore,
    defaultSemanticRecordingCore,
    "context.recordingCore",
    (value) => {
      try {
        validateSemanticRecordingCore(value);
        return true;
      } catch {
        return false;
      }
    },
    invalidArtifacts,
  );
  const validatedHelperOrchestrationCore = coerceValidated(
    helperOrchestrationCore,
    defaultHelperOrchestrationCore,
    "context.helperOrchestrationCore",
    (value) => {
      try {
        validateHelperOrchestrationCore(value);
        return true;
      } catch {
        return false;
      }
    },
    invalidArtifacts,
  );
  const validatedLearningLoopCore = coerceValidated(
    learningLoopCore,
    defaultLearningLoopCore,
    "context.learningLoopCore",
    (value) => {
      try {
        validateLearningLoopCore(value);
        return true;
      } catch {
        return false;
      }
    },
    invalidArtifacts,
  );
  const validatedPromptStrategyCore = coerceValidated(
    promptStrategyCore,
    defaultPromptStrategyCore,
    "context.promptStrategyCore",
    (value) => {
      try {
        validatePromptStrategyCore(value);
        return true;
      } catch {
        return false;
      }
    },
    invalidArtifacts,
  );
  const validatedContextEconomyCore = coerceValidated(
    contextEconomyCore,
    defaultContextEconomyCore,
    "context.contextEconomyCore",
    (value) => {
      try {
        validateContextEconomyCore(value);
        return true;
      } catch {
        return false;
      }
    },
    invalidArtifacts,
  );
  const validatedEnvironmentAwarenessCore = coerceValidated(
    environmentAwarenessCore,
    defaultEnvironmentAwarenessCore,
    "context.environmentAwarenessCore",
    (value) => {
      try {
        validateEnvironmentAwarenessCore(value);
        return true;
      } catch {
        return false;
      }
    },
    invalidArtifacts,
  );
  const validatedCoreSourceIngest = coerceValidated(
    coreSourceIngest,
    defaultCoreSourceIngest,
    "context.coreSourceIngest",
    (value) => {
      try {
        validateCoreSourceIngest(value);
        return true;
      } catch {
        return false;
      }
    },
    invalidArtifacts,
  );
  const validatedUniversalPluginBrokerCore = coerceValidated(
    universalPluginBrokerCore,
    defaultUniversalPluginBrokerCore,
    "context.universalPluginBrokerCore",
    (value) => {
      try {
        validateUniversalPluginBrokerCore(value);
        return true;
      } catch {
        return false;
      }
    },
    invalidArtifacts,
  );
  const validatedObsidianBridge = coerceValidated(
    obsidianBridge,
    defaultObsidianBridge,
    "context.obsidianBridge",
    (value) => {
      try {
        validateObsidianBridge(value);
        return true;
      } catch {
        return false;
      }
    },
    invalidArtifacts,
  );
  const validatedObsidianVaultIndex = coerceValidated(
    obsidianVaultIndex,
    defaultObsidianVaultIndex,
    "context.obsidianVaultIndex",
    (value) => {
      try {
        validateObsidianVaultIndex(value);
        return true;
      } catch {
        return false;
      }
    },
    invalidArtifacts,
  );
  const validatedObsidianVaultOperations = coerceValidated(
    obsidianVaultOperations,
    defaultObsidianVaultOperations,
    "context.obsidianVaultOperations",
    (value) => {
      try {
        validateObsidianVaultOperations(value);
        return true;
      } catch {
        return false;
      }
    },
    invalidArtifacts,
  );
  const validatedWorkspaceVirtualizer = coerceValidated(
    workspaceVirtualizer,
    defaultWorkspaceVirtualizer,
    "context.workspaceVirtualizer",
    (value) => {
      try {
        validateWorkspaceVirtualizer(value);
        return true;
      } catch {
        return false;
      }
    },
    invalidArtifacts,
  );
  const validatedCodeGraphRehearse = coerceValidated(
    codeGraphRehearse,
    defaultCodeGraphRehearse,
    "context.codeGraphRehearse",
    (value) => {
      try {
        validateCodeGraphRehearse(value);
        return true;
      } catch {
        return false;
      }
    },
    invalidArtifacts,
  );
  const validatedCodeburnUsage = coerceValidated(
    codeburnUsage,
    defaultCodeburnUsage,
    "context.codeburnUsage",
    (value) =>
      value &&
      typeof value === "object" &&
      value.schemaVersion === defaultCodeburnUsage.schemaVersion &&
      Array.isArray(value.entries) &&
      Number.isFinite(value.totalTokens) &&
      Number.isFinite(value.totalCost),
    invalidArtifacts,
  );
  const validatedSkillsRegistryExport = coerceValidated(
    skillsRegistryExport,
    defaultSkillsRegistryExport,
    "context.skillsRegistryExport",
    (value) => {
      try {
        validateSkillsRegistryExport(value);
        return true;
      } catch {
        return false;
      }
    },
    invalidArtifacts,
  );
  const validatedCapabilityComposition = coerceValidated(
    capabilityComposition,
    defaultCapabilityComposition,
    "context.capabilityComposition",
    (value) => {
      try {
        validateCapabilityComposition(value);
        return true;
      } catch {
        return false;
      }
    },
    invalidArtifacts,
  );
  const validatedWorkspaceContextPack = coerceValidated(
    workspaceContextPack,
    defaultWorkspaceContextPack,
    "context.workspaceContextPack",
    (value) => {
      try {
        validateWorkspaceContextPack(value);
        return true;
      } catch {
        return false;
      }
    },
    invalidArtifacts,
  );
  const validatedWorkspaceEffectiveness = coerceValidated(
    workspaceEffectiveness,
    defaultWorkspaceEffectiveness,
    "context.workspaceEffectiveness",
    (value) => {
      try {
        validateWorkspaceEffectiveness(value);
        return true;
      } catch {
        return false;
      }
    },
    invalidArtifacts,
  );
  const validatedSemanticReceiptIndex = coerceValidated(
    semanticReceiptIndex,
    defaultSemanticReceiptIndex,
    "evidence.semanticReceipts",
    (value) => {
      try {
        validateSemanticReceiptIndex(value);
        return true;
      } catch {
        return false;
      }
    },
    invalidArtifacts,
  );

  return {
    mergedGuidance: validatedMergedGuidance,
    guidanceGraph: validatedGuidanceGraph,
    graphifyIndex: validatedGraphifyIndex,
    continuityIndex: validatedContinuityIndex,
    continuityGraph: validatedContinuityGraph,
    continuityNotes,
    hookConfig: validatedHookConfig,
    taskRegistry: validatedTaskRegistry,
    mailboxEntries,
    workspaceIndex: validatedWorkspaceIndex,
    release,
    decisions: validatedDecisions,
    audits: validatedAudits,
    cves: validatedCves,
    releaseIssueGateStatus,
    releaseIssueGatesSource: releaseIssueGatesResolution,
    managerRuns: validatedManagerRuns,
    maestroState: validatedMaestroState,
    activeAutonomyCore: validatedActiveAutonomyCore,
    semanticRecordingCore: validatedSemanticRecordingCore,
    helperOrchestrationCore: validatedHelperOrchestrationCore,
    learningLoopCore: validatedLearningLoopCore,
    promptStrategyCore: validatedPromptStrategyCore,
    contextEconomyCore: validatedContextEconomyCore,
    environmentAwarenessCore: validatedEnvironmentAwarenessCore,
    coreSourceIngest: validatedCoreSourceIngest,
    universalPluginBrokerCore: validatedUniversalPluginBrokerCore,
    obsidianBridge: validatedObsidianBridge,
    obsidianVaultIndex: validatedObsidianVaultIndex,
    obsidianVaultOperations: validatedObsidianVaultOperations,
    workspaceVirtualizer: validatedWorkspaceVirtualizer,
    codeGraphRehearse: validatedCodeGraphRehearse,
    codeburnUsage: validatedCodeburnUsage,
    skillsRegistryExport: validatedSkillsRegistryExport,
    capabilityComposition: validatedCapabilityComposition,
    workspaceContextPack: validatedWorkspaceContextPack,
    workspaceEffectiveness: validatedWorkspaceEffectiveness,
    semanticReceiptIndex: validatedSemanticReceiptIndex,
    missingArtifacts,
    invalidArtifacts,
  };
}

export function createRuntimeSummary(snapshot) {
  const trimmedNotes = snapshot.continuityNotes.trim();
  const criticalPackageExposureCount = snapshot.audits.items.filter(
    (item) =>
      item?.record_type === "finding:package_exposure" &&
      `${item.severity}`.toLowerCase() === "critical",
  ).length;
  const mcpPolicyViolationCount = snapshot.audits.items.filter(
    (item) =>
      item?.record_type === "policy:mcp_validation" &&
      ["critical", "high"].includes(`${item.severity}`.toLowerCase()),
  ).length;
  return {
    guidanceSourceCount: snapshot.mergedGuidance.sources.length,
    guidanceIncludeRoots: snapshot.guidanceGraph.roots.length,
    graphNodeCount: snapshot.graphifyIndex.nodes.length,
    graphEdgeCount: snapshot.graphifyIndex.edges.length,
    graphLastRebuiltAt: snapshot.graphifyIndex.lastRebuiltAt,
    continuitySessionCount: snapshot.continuityIndex.sessionCount,
    continuityHasNotes:
      trimmedNotes.length > 0 &&
      trimmedNotes !== "# Continuity Notes\n\nNo continuity notes captured yet.",
    compatibilityHookCount: snapshot.hookConfig.compatibilityNamespace.length,
    runtimeHookCount: snapshot.hookConfig.runtimeNamespace.length,
    configuredRuntimeHookCount: snapshot.hookConfig.hooks.length,
    workerCount: snapshot.taskRegistry.workers.length,
    taskCount: snapshot.taskRegistry.tasks.length,
    pendingMailboxCount: snapshot.mailboxEntries.length,
    workspaceCount: snapshot.workspaceIndex.items.length,
    decisionCount: snapshot.decisions.decisions.length,
    mcpPolicyViolationCount,
    managerRunCount: snapshot.managerRuns.runs.length,
    activeManagerRunCount: snapshot.managerRuns.runs.filter(
      (run) => !terminalManagerStates.has(run.state),
    ).length,
    waitingReviewManagerRunCount: snapshot.managerRuns.runs.filter(
      (run) => run.state === "waiting-review",
    ).length,
    maestroGlobalStatus: snapshot.maestroState.global_status,
    maestroTrackCount: Object.keys(snapshot.maestroState.runtime_tracks).length,
    semanticRecordingLayerCount: snapshot.semanticRecordingCore.layers.length,
    semanticDefaultCoreCount: Object.keys(snapshot.semanticRecordingCore.default_core_capabilities)
      .length,
    helperCoreContractCount: snapshot.helperOrchestrationCore.helper_contracts.length,
    helperCoreNonGating: snapshot.helperOrchestrationCore.composition_rules.non_gating === true,
    helperCoreReleaseMutationAllowed:
      snapshot.helperOrchestrationCore.composition_rules.release_state_mutation_allowed === true,
    learningLoopDomainCount: snapshot.learningLoopCore.domains.length,
    learningLoopRecordCount: snapshot.learningLoopCore.records.length,
    activeAutonomyAskOnlyCount: snapshot.activeAutonomyCore.decision_rule.ask_only_when.length,
    activeAutonomyStallPatternCount:
      snapshot.activeAutonomyCore.runtime_enforcement.stall_patterns.length,
    activeAutonomyHookEnabled: snapshot.hookConfig.activeAutonomy.enabled,
    promptStrategyTechniqueFamilyCount: snapshot.promptStrategyCore.technique_families.length,
    promptStrategyLaneCount: Object.keys(snapshot.promptStrategyCore.lane_policy).length,
    contextEconomyAppliesToCount: snapshot.contextEconomyCore.applies_to.length,
    contextEconomyPreserveExactCount: snapshot.contextEconomyCore.preserve_exact.length,
    contextEconomySafetyValveCount: snapshot.contextEconomyCore.safety_valves.length,
    environmentCapabilityCount: snapshot.environmentAwarenessCore.capabilities.length,
    environmentCapabilityTypes: [
      ...new Set(
        snapshot.environmentAwarenessCore.capabilities.map(
          (capability) => capability.capability_type,
        ),
      ),
    ].sort(),
    environmentRecordsAs: snapshot.environmentAwarenessCore.discovery_policy.records_as,
    environmentNeverRecordsAs: snapshot.environmentAwarenessCore.discovery_policy.never_records_as,
    coreSourceIngestStatus: snapshot.coreSourceIngest.status ?? "NOT_INGESTED",
    coreSourceIngestCount: snapshot.coreSourceIngest.sources.filter((source) =>
      ["INGESTED", "LOCAL_CORE"].includes(source.status),
    ).length,
    coreSourceRuntimeFetchRequired: snapshot.coreSourceIngest.runtime_fetch_required,
    universalPluginBrokerSupportedAgentCount:
      snapshot.universalPluginBrokerCore.supported_agents.length,
    universalPluginBrokerMcpInjectorHosts:
      snapshot.universalPluginBrokerCore.mcp_injector_hosts.length,
    universalPluginBrokerRecordsAs: snapshot.universalPluginBrokerCore.mutation_policy.records_as,
    universalPluginBrokerNeverRecordsAs:
      snapshot.universalPluginBrokerCore.mutation_policy.never_records_as,
    obsidianBridgeRecordsAs: snapshot.obsidianBridge.semantic_boundary.records_as,
    obsidianBridgeNeverRecordsAs: snapshot.obsidianBridge.semantic_boundary.never_records_as,
    obsidianBridgeQueuedRequestCount: snapshot.obsidianBridge.default_request_queue.length,
    obsidianBridgeNoteSelectionCount: snapshot.obsidianBridge.note_selection_metadata.length,
    obsidianBridgeTagGraphClaimCount: snapshot.obsidianBridge.tag_graph_claims.length,
    obsidianVaultIndexed: snapshot.obsidianVaultIndex.note_count > 0,
    obsidianVaultPath: snapshot.obsidianVaultIndex.vault_path,
    obsidianVaultNoteCount: snapshot.obsidianVaultIndex.note_count,
    obsidianVaultTagCount: snapshot.obsidianVaultIndex.tags.length,
    obsidianVaultUnresolvedLinkCount: snapshot.obsidianVaultIndex.unresolved_links.length,
    obsidianVaultOperationCount: snapshot.obsidianVaultOperations.operations.length,
    workspaceVirtualizerRecordsAs: snapshot.workspaceVirtualizer.evidence_boundary.records_as,
    workspaceVirtualizerNeverRecordsAs:
      snapshot.workspaceVirtualizer.evidence_boundary.never_records_as,
    workspaceVirtualizerSourceMutationAllowed:
      snapshot.workspaceVirtualizer.mutation_policy.may_mutate_source,
    codeGraphRehearseRecordsAs: snapshot.codeGraphRehearse.evidence_boundary.records_as,
    codeGraphRehearseSourceMutationAllowed:
      snapshot.codeGraphRehearse.mutation_policy.may_mutate_source,
    codeGraphRehearseMaxSteps: snapshot.codeGraphRehearse.max_steps,
    tokenUsage: snapshot.codeburnUsage.totalTokens,
    estimatedCost: snapshot.codeburnUsage.totalCost,
    skillsRegistryCanonicalDir: snapshot.skillsRegistryExport.canonical_dir,
    skillsRegistryReleaseMutationAllowed:
      snapshot.skillsRegistryExport.authority_boundary.exported_payloads_may_mutate_release_state,
    skillsRegistryUniversalTargetCount: snapshot.skillsRegistryExport.universal_targets.length,
    skillsRegistryNonUniversalTargetCount:
      snapshot.skillsRegistryExport.non_universal_targets.length,
    capabilityCompositionCount: snapshot.capabilityComposition.capability_matrix.length,
    workspaceContextChannelCount: Object.keys(snapshot.workspaceContextPack.semantic_channels)
      .length,
    workspaceEffectivenessReady: snapshot.workspaceEffectiveness.ready,
    workspaceEffectivenessCheckCount: snapshot.workspaceEffectiveness.checks.length,
    semanticReceiptCount: snapshot.semanticReceiptIndex.receipts.length,
    obsidianSemanticRole:
      snapshot.semanticRecordingCore.default_core_capabilities.obsidian_integration_core
        .semantic_role,
    obsidianRecordsAs:
      snapshot.semanticRecordingCore.default_core_capabilities.obsidian_integration_core.records_as,
    buildStatus: snapshot.release.build_status,
    auditCount: snapshot.audits.items.length,
    cveCount: snapshot.cves.items.length,
    releaseIssueGateTotal: snapshot.releaseIssueGateStatus.total,
    releaseIssueGatePassed: snapshot.releaseIssueGateStatus.passed,
    releaseIssueGateBlockerCount: snapshot.releaseIssueGateStatus.blockers.length,
    criticalPackageExposureCount,
    missingArtifacts: snapshot.missingArtifacts,
    invalidArtifacts: snapshot.invalidArtifacts,
  };
}

export async function repairRuntimeScratchpadArtifacts(artifactLabels = []) {
  const labels = [...new Set(artifactLabels)].filter((label) =>
    repairableRuntimeArtifacts.has(label),
  );

  for (const label of labels) {
    switch (label) {
      case "guidance.merged":
        await writeJson(getMergedGuidancePath(), defaultMergedGuidance);
        break;
      case "guidance.includeGraph":
        await writeJson(getGuidanceIncludeGraphPath(), defaultGuidanceGraph);
        break;
      case "context.activeAutonomyCore":
        await writeJson(getActiveAutonomyCorePath(), defaultActiveAutonomyCore);
        break;
      case "context.recordingCore":
        await writeJson(getSemanticRecordingCorePath(), defaultSemanticRecordingCore);
        break;
      case "context.helperOrchestrationCore":
        await writeJson(getHelperOrchestrationCorePath(), defaultHelperOrchestrationCore);
        break;
      case "context.learningLoopCore":
        await writeJson(getLearningLoopCorePath(), defaultLearningLoopCore);
        break;
      case "context.promptStrategyCore":
        await writeJson(getPromptStrategyCorePath(), defaultPromptStrategyCore);
        break;
      case "context.contextEconomyCore":
        await writeJson(getContextEconomyCorePath(), defaultContextEconomyCore);
        break;
      case "context.environmentAwarenessCore":
        await writeJson(getEnvironmentAwarenessCorePath(), defaultEnvironmentAwarenessCore);
        break;
      case "context.coreSourceIngest":
        await writeJson(getCoreSourceIngestPath(), defaultCoreSourceIngest);
        break;
      case "context.universalPluginBrokerCore":
        await writeJson(getUniversalPluginBrokerCorePath(), defaultUniversalPluginBrokerCore);
        break;
      case "context.obsidianVaultOperations":
        await writeJson(getObsidianVaultOperationsPath(), defaultObsidianVaultOperations);
        break;
      case "context.workspaceVirtualizer":
        await writeJson(getWorkspaceVirtualizerPath(), defaultWorkspaceVirtualizer);
        break;
      case "context.codeGraphRehearse":
        await writeJson(getCodeGraphRehearsePath(), defaultCodeGraphRehearse);
        break;
      case "context.skillsRegistryExport":
        await writeJson(getSkillsRegistryExportPath(), defaultSkillsRegistryExport);
        break;
      case "context.capabilityComposition":
        await writeJson(getCapabilityCompositionPath(), defaultCapabilityComposition);
        break;
      case "context.workspaceContextPack":
        await writeJson(getWorkspaceContextPackPath(), defaultWorkspaceContextPack);
        break;
      case "context.workspaceEffectiveness":
        await writeJson(getWorkspaceEffectivenessPath(), defaultWorkspaceEffectiveness);
        break;
      case "evidence.semanticReceipts":
        await writeJson(getSemanticReceiptIndexPath(), defaultSemanticReceiptIndex);
        break;
      case "memory.index":
        await writeJson(getContinuityIndexPath(), defaultContinuityIndex);
        break;
      case "memory.graph":
        await writeJson(getContinuityGraphPath(), defaultContinuityGraph);
        break;
      case "hooks.config":
        await writeJson(getRuntimeHooksConfigPath(), defaultHookConfig);
        break;
      case "tasks.registry":
        await writeJson(getTaskRegistryPath(), defaultTaskRegistry);
        break;
      case "workspaces.index":
        await writeJson(getWorkspacesIndexPath(), defaultWorkspaceIndex);
        break;
      case "runtime.managerRuns":
        await writeJson(getManagerRunsPath(), defaultManagerRuns);
        break;
      case "runtime.maestroState":
        await writeJson(getMaestroStatePath(), defaultMaestroState);
        break;
      default:
        break;
    }
  }

  return labels;
}
