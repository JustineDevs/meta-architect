import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { writeJson } from "../fs-utils.js";
import { getRuntimeSubsystemPath } from "../paths.js";
import {
  discoverCodexCapabilityInventory,
  persistCodexCapabilityInventory,
  selectCodexCapabilitiesForTask,
} from "./codex-capability-inventory.js";
import {
  createDefaultEnvironmentAwarenessCore,
  discoverEnvironmentCapabilities,
  selectEnvironmentCapabilitiesForTask,
} from "./environment-awareness-core.js";

export const skillCompositionSchemaVersion = "0.1.0";
export const chaiDiscoveryFramework = "chai-discovery";
export const kaizenFramework = "kaizen";

const stopWords = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "into",
  "your",
  "have",
  "will",
  "should",
  "must",
  "need",
  "task",
  "work",
  "code",
  "project",
  "use",
  "using",
  "make",
]);
const discoveryCache = new Map();

function tokens(value) {
  return [
    ...new Set(
      String(value ?? "")
        .toLowerCase()
        .match(/[a-z0-9][a-z0-9-]{2,}/g) ?? [],
    ),
  ].filter((token) => !stopWords.has(token));
}

function tokenVariants(token) {
  const value = String(token ?? "");
  const variants = new Set([value]);
  if (value.endsWith("ies") && value.length > 4) variants.add(`${value.slice(0, -3)}y`);
  if (value.endsWith("ing") && value.length > 5) variants.add(value.slice(0, -3));
  if (value.endsWith("ed") && value.length > 4) variants.add(value.slice(0, -2));
  if (value.endsWith("s") && value.length > 3) variants.add(value.slice(0, -1));
  return variants;
}

function tokensMatch(left, right) {
  const rightVariants = new Set(
    [...tokenVariants(right)].flatMap((token) => [...tokenVariants(token)]),
  );
  return [...tokenVariants(left)].some((token) => rightVariants.has(token));
}

function scopeRank(scope) {
  return { repo_local: 40, global_user_config: 30, package_local: 20 }[scope] ?? 0;
}

function capabilityTokens(capability) {
  return tokens(
    [capability.name, capability.metadata?.description, capability.capability_type].join(" "),
  );
}

function scoreCapability(capability, intentTokens) {
  const words = capabilityTokens(capability);
  const nameWords = tokens(capability.name);
  let score = 0;
  for (const token of intentTokens) {
    if (nameWords.some((word) => tokensMatch(token, word))) score += 12;
    else if (words.some((word) => tokensMatch(token, word))) score += 4;
  }
  if (score === 0) return 0;
  return score + scopeRank(capability.source_scope) + (capability.owner === "ma_owned" ? 2 : 0);
}

function uniqueByName(capabilities) {
  const selected = new Map();
  for (const capability of capabilities) {
    const current = selected.get(capability.name);
    if (!current || scopeRank(capability.source_scope) > scopeRank(current.source_scope)) {
      selected.set(capability.name, capability);
    }
  }
  return [...selected.values()];
}

function normalizeCandidate(capability, score, reason) {
  return {
    name: capability.name,
    capabilityType: capability.capability_type,
    owner: capability.owner,
    scope: capability.source_scope,
    sourcePath: capability.source_path,
    entrypoint: capability.entrypoint,
    description: capability.metadata?.description ?? null,
    score,
    reason,
    executionBoundary: "available_capability_only",
    mutationAllowed: false,
    evidenceStatus: "not_executed",
  };
}

function composeCandidates(candidates, maxSkills, { ambientFallback = false } = {}) {
  const chosen = candidates
    .filter(
      (candidate) =>
        candidate.score > 0 ||
        (ambientFallback && candidate.capability.capability_type === "skill"),
    )
    .slice(0, maxSkills);
  const chosenNames = new Set(chosen.map((candidate) => candidate.capability.name));
  const dependencies = [];
  for (const { capability } of chosen) {
    const references = capability.metadata?.references ?? [];
    for (const reference of references) {
      const name = reference.replace(/^\$/, "");
      if (chosenNames.has(name)) dependencies.push({ from: capability.name, to: name });
    }
  }
  const byName = new Map(chosen.map((candidate) => [candidate.capability.name, candidate]));
  const ordered = [];
  const visited = new Set();
  const visit = (candidate) => {
    if (visited.has(candidate.capability.name)) return;
    visited.add(candidate.capability.name);
    for (const dependency of candidate.capability.metadata?.references ?? []) {
      const dependencyCandidate = byName.get(dependency.replace(/^\$/, ""));
      if (dependencyCandidate) visit(dependencyCandidate);
    }
    ordered.push(candidate);
  };
  for (const candidate of chosen) visit(candidate);
  return { chosen: ordered, dependencies };
}

function createDiscoveryTrace({ capabilities, intentTokens, selected, dependencies }) {
  const scopes = [...new Set(capabilities.map((capability) => capability.source_scope))];
  const types = [...new Set(capabilities.map((capability) => capability.capability_type))];
  return {
    framework: chaiDiscoveryFramework,
    stages: ["collect", "classify", "rank", "compose", "bound"],
    collected: capabilities.length,
    scopes,
    capabilityTypes: types,
    intentTokens,
    ranked: capabilities.length,
    composed: selected.length,
    dependencies: dependencies.length,
    boundary: "available_capability_only",
  };
}

function createKaizenState({ taskIntent, feedback, selected }) {
  const failedChecks = Array.isArray(feedback?.failedChecks)
    ? feedback.failedChecks.map((check) => String(check).slice(0, 200)).filter(Boolean)
    : [];
  const reason = feedback?.reason ? String(feedback.reason).slice(0, 500) : null;
  return {
    framework: kaizenFramework,
    cycle: "plan-do-check-act",
    iteration: Number.isInteger(feedback?.iteration) ? Math.max(0, feedback.iteration) : 0,
    phase: feedback ? "act" : "plan",
    objective: String(taskIntent ?? "").slice(0, 500),
    observed: feedback ? "verification_feedback" : "initial_discovery",
    feedback: reason || failedChecks.length ? { reason, failedChecks } : null,
    selectedForNextAttempt: selected.map((candidate) => candidate.name),
    nextAction: feedback
      ? "retry_with_rerouted_capabilities_and_verify_again"
      : "execute_selected_capabilities_then_capture_verification_feedback",
    promotion: "verified_outcome_required_before_policy_change",
  };
}

export function validateSkillCompositionPlan(plan) {
  if (
    !plan ||
    plan.schemaVersion !== skillCompositionSchemaVersion ||
    plan.record_type !== "skill_composition_plan"
  ) {
    throw new Error("invalid skill composition plan schema");
  }
  for (const field of [
    "selected",
    "candidates",
    "skipped",
    "dependencies",
    "conflicts",
    "feedback_routes",
  ]) {
    if (!Array.isArray(plan[field])) throw new Error(`skill composition plan requires ${field}`);
  }
  if (
    plan.records_as !== "available_capability_plan" ||
    plan.never_records_as !== "build_evidence"
  ) {
    throw new Error("skill composition plan has an invalid evidence boundary");
  }
  if (plan.execution_policy?.mutate_skill_sources !== false) {
    throw new Error("skill composition plan cannot mutate skill sources");
  }
  if (!plan.discovery || plan.discovery.framework !== chaiDiscoveryFramework) {
    throw new Error("skill composition plan requires the Chai Discovery framework");
  }
  if (plan.improvement?.framework !== kaizenFramework) {
    throw new Error("skill composition plan requires the Kaizen improvement framework");
  }
  return plan;
}

export function getSkillCompositionPlanPath() {
  return getRuntimeSubsystemPath("context", "skill-composition-plan.json");
}

export function createSkillCompositionPlan({
  core,
  taskIntent = "",
  maxSkills = 6,
  feedback = null,
  codexInventory = null,
} = {}) {
  if (!core) throw new Error("skill composition requires environment awareness core");
  const document = createDefaultEnvironmentAwarenessCore({ capabilities: core.capabilities });
  const intent = [taskIntent, feedback?.reason, ...(feedback?.failedChecks ?? [])]
    .filter(Boolean)
    .join(" ");
  const intentTokens = tokens(intent);
  const ranked = uniqueByName(document.capabilities)
    .map((capability) => ({
      capability,
      score: scoreCapability(capability, intentTokens),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        scopeRank(b.capability.source_scope) - scopeRank(a.capability.source_scope) ||
        a.capability.name.localeCompare(b.capability.name),
    );
  const ambientFallback = intentTokens.length > 0 && ranked.every(({ score }) => score === 0);
  const candidates = ranked.map(({ capability, score }) =>
    normalizeCandidate(
      capability,
      score,
      score > 0
        ? feedback
          ? "verification_feedback_match"
          : "intent_match"
        : ambientFallback && capability.capability_type === "skill"
          ? "ambient_fallback"
          : "not_relevant",
    ),
  );
  const { chosen, dependencies } = composeCandidates(ranked, maxSkills, { ambientFallback });
  const selected = chosen.map(({ capability, score }) =>
    normalizeCandidate(
      capability,
      score,
      score > 0 ? (feedback ? "verification_feedback_match" : "intent_match") : "ambient_fallback",
    ),
  );
  const codexSelection = codexInventory
    ? selectCodexCapabilitiesForTask(codexInventory, taskIntent, 8)
    : null;
  return validateSkillCompositionPlan({
    schemaVersion: skillCompositionSchemaVersion,
    record_type: "skill_composition_plan",
    task_intent: taskIntent,
    feedback: feedback
      ? {
          reason: String(feedback.reason ?? "").slice(0, 500),
          failedChecks: [...(feedback.failedChecks ?? [])],
        }
      : null,
    selected,
    candidates,
    skipped: candidates.filter(
      (candidate) => !selected.some((item) => item.name === candidate.name),
    ),
    dependencies,
    conflicts: [],
    discovery: createDiscoveryTrace({
      capabilities: uniqueByName(document.capabilities),
      intentTokens,
      selected,
      dependencies,
    }),
    improvement: createKaizenState({ taskIntent, feedback, selected }),
    codex_inventory: codexInventory
      ? {
          schemaVersion: codexInventory.schemaVersion,
          generatedAt: codexInventory.generatedAt,
          codex: codexInventory.codex,
          summary: codexInventory.summary,
          selection: codexSelection,
          capabilities: codexInventory.capabilities,
        }
      : null,
    execution_policy: {
      reuse_existing_skills: true,
      mutate_skill_sources: false,
      auto_execute_discovered_tools: false,
      skill_execution: "load_instruction_context_in_dependency_order",
      third_party_execution_claim: "only_with_host_receipt",
      verification_required_after_use: true,
    },
    feedback_routes: [
      "route_failed_tests_to_tdd_or_test-focused_skill",
      "route_security_findings_to_security-or-red-team skill",
      "route_latency-or-cost findings to optimization skill",
      "route architecture violations to architecture skill",
      "replan once per bounded retry and preserve the failure receipt",
    ],
    records_as: "available_capability_plan",
    never_records_as: "build_evidence",
  });
}

export async function brokerSkillsForTask({
  cwd = process.cwd(),
  home = os.homedir(),
  includeGlobal = true,
  includeCodex = true,
  taskIntent,
  feedback = null,
} = {}) {
  const cacheKey = `${path.resolve(cwd)}\0${path.resolve(home)}\0${includeGlobal}\0${includeCodex}`;
  const cached = discoveryCache.get(cacheKey);
  const capabilities =
    cached && Date.now() - cached.createdAt < 5_000
      ? cached.capabilities
      : await discoverEnvironmentCapabilities({ cwd, home, includeGlobal });
  if (!cached || Date.now() - cached.createdAt >= 5_000) {
    discoveryCache.set(cacheKey, { createdAt: Date.now(), capabilities });
  }
  const core = createDefaultEnvironmentAwarenessCore({ capabilities });
  const codexInventory = includeCodex ? discoverCodexCapabilityInventory({ cwd, home }) : null;
  if (codexInventory) await persistCodexCapabilityInventory(codexInventory);
  return createSkillCompositionPlan({ core, taskIntent, feedback, codexInventory });
}

export async function persistSkillCompositionPlan(plan) {
  validateSkillCompositionPlan(plan);
  await fs.mkdir(path.dirname(getSkillCompositionPlanPath()), { recursive: true });
  await writeJson(getSkillCompositionPlanPath(), plan);
  return plan;
}

export function createSkillOutcomeFeedback({
  status,
  reason = null,
  failedChecks = [],
  evidence = [],
  iteration = 0,
} = {}) {
  return {
    status: String(status ?? "unknown"),
    reason: reason ? String(reason).slice(0, 500) : null,
    failedChecks: Array.isArray(failedChecks)
      ? failedChecks.map((check) => String(check).slice(0, 200)).filter(Boolean)
      : [],
    evidence: Array.isArray(evidence)
      ? evidence
          .map((entry) => String(entry).slice(0, 500))
          .filter(Boolean)
          .slice(0, 20)
      : [],
    iteration: Number.isInteger(iteration) ? Math.max(0, iteration) : 0,
  };
}

export async function recordSkillKaizenCycle({ taskId = null, plan, outcome } = {}) {
  validateSkillCompositionPlan(plan);
  const target = getRuntimeSubsystemPath("learning", "skill-kaizen.ndjson");
  await fs.mkdir(path.dirname(target), { recursive: true });
  const record = {
    schemaVersion: skillCompositionSchemaVersion,
    record_type: "skill_kaizen_cycle",
    taskId: taskId ? String(taskId).slice(0, 120) : null,
    timestamp: new Date().toISOString(),
    discovery: plan.discovery,
    improvement: {
      ...plan.improvement,
      outcome: createSkillOutcomeFeedback(outcome),
    },
    selected: plan.selected.map((candidate) => candidate.name),
    records_as: "workflow_improvement_receipt",
    never_records_as: "build_evidence",
  };
  await fs.appendFile(target, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

export function rerouteSkillComposition(plan, feedback) {
  const rerouted = createSkillCompositionPlan({
    core: {
      capabilities: (plan?.candidates ?? []).map((candidate) => ({
        record_type: "environment_capability",
        name: candidate.name,
        capability_type: candidate.capabilityType,
        owner: candidate.owner,
        source_scope: candidate.scope,
        source_path: candidate.sourcePath,
        entrypoint: candidate.entrypoint,
        confidence: "medium",
        metadata: { description: candidate.description, references: [] },
        records_as: "available_capability",
        never_records_as: "build_evidence",
        mutation_allowed: false,
        may_use_when: ["task_relevant"],
        use_requires: ["$maestro_or_owning_lane_selection"],
        authority: "$maestro_or_owning_lane",
      })),
    },
    taskIntent: plan?.task_intent ?? "",
    feedback: {
      ...feedback,
      iteration: (plan?.improvement?.iteration ?? 0) + 1,
    },
  });
  return rerouted;
}

export function selectBrokerCapabilities(core, taskIntent) {
  return selectEnvironmentCapabilitiesForTask(core, taskIntent);
}
