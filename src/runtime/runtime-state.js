import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { readJson, writeJson } from "../fs-utils.js";
import { getRuntimeReadPath } from "../paths.js";
import { createDefaultReleaseState, validateReleaseState } from "../release-state.js";
import {
  getContinuityIndexPath,
  getContinuityNotesPath,
  seedContinuityArtifacts,
} from "./continuity-notes.js";
import {
  getGuidanceIncludeGraphPath,
  getMergedGuidancePath,
  seedGuidanceStackArtifacts,
} from "./guidance-stack.js";
import { getManagerRunsPath, seedMaestroManagerArtifacts } from "./maestro-manager.js";
import {
  getTaskLockRoot,
  getTaskMailboxRoot,
  getTaskRegistryPath,
  seedOrchestratorArtifacts,
} from "./orchestrator.js";
import {
  getRuntimeHooksAuditPath,
  getRuntimeHooksConfigPath,
  seedSignalHookArtifacts,
} from "./signal-hooks.js";
import { getWorkspacesIndexPath, seedWorkspaceArtifacts } from "./workspaces.js";

const runtimeSubsystemSeeders = [
  seedGuidanceStackArtifacts,
  seedContinuityArtifacts,
  seedSignalHookArtifacts,
  seedOrchestratorArtifacts,
  seedWorkspaceArtifacts,
  seedMaestroManagerArtifacts,
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
const defaultManagerRuns = {
  schemaVersion: "0.1.0",
  runs: [],
};
const terminalManagerStates = new Set(["completed", "blocked", "failed", "cancelled"]);

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

  const [
    mergedGuidance,
    guidanceGraph,
    continuityIndex,
    continuityNotes,
    hookConfig,
    taskRegistry,
    workspaceIndex,
    release,
    decisions,
    managerRuns,
  ] = await Promise.all([
    readJsonWithStatus(getMergedGuidancePath(), defaultMergedGuidance, "guidance.merged"),
    readJsonWithStatus(
      getGuidanceIncludeGraphPath(),
      defaultGuidanceGraph,
      "guidance.includeGraph",
    ),
    readJsonWithStatus(getContinuityIndexPath(), defaultContinuityIndex, "memory.index"),
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
    readJsonWithStatus(getManagerRunsPath(), defaultManagerRuns, "runtime.managerRuns"),
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
  const validatedHookConfig = coerceValidated(
    hookConfig,
    defaultHookConfig,
    "hooks.config",
    (value) =>
      value &&
      typeof value === "object" &&
      Array.isArray(value.compatibilityNamespace) &&
      Array.isArray(value.runtimeNamespace) &&
      Array.isArray(value.hooks),
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
  const validatedManagerRuns = coerceValidated(
    managerRuns,
    defaultManagerRuns,
    "runtime.managerRuns",
    (value) => value && typeof value === "object" && Array.isArray(value.runs),
    invalidArtifacts,
  );

  return {
    mergedGuidance: validatedMergedGuidance,
    guidanceGraph: validatedGuidanceGraph,
    continuityIndex: validatedContinuityIndex,
    continuityNotes,
    hookConfig: validatedHookConfig,
    taskRegistry: validatedTaskRegistry,
    mailboxEntries,
    workspaceIndex: validatedWorkspaceIndex,
    release,
    decisions: validatedDecisions,
    managerRuns: validatedManagerRuns,
    missingArtifacts,
    invalidArtifacts,
  };
}

export function createRuntimeSummary(snapshot) {
  const trimmedNotes = snapshot.continuityNotes.trim();
  return {
    guidanceSourceCount: snapshot.mergedGuidance.sources.length,
    guidanceIncludeRoots: snapshot.guidanceGraph.roots.length,
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
    managerRunCount: snapshot.managerRuns.runs.length,
    activeManagerRunCount: snapshot.managerRuns.runs.filter(
      (run) => !terminalManagerStates.has(run.state),
    ).length,
    waitingReviewManagerRunCount: snapshot.managerRuns.runs.filter(
      (run) => run.state === "waiting-review",
    ).length,
    buildStatus: snapshot.release.build_status,
    missingArtifacts: snapshot.missingArtifacts,
    invalidArtifacts: snapshot.invalidArtifacts,
  };
}
