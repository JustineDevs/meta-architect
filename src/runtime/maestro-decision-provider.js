import { createHash } from "node:crypto";

const DEFAULT_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const DEFAULT_MODEL = "jev-latest";
const DEFAULT_TIMEOUT_MS = 10_000;

const safeLanePattern = /^\$(?:align|diagnose|tdd|arch|sage|flow|vet|vibe|build)$/;

function boundedText(value, max = 2_000) {
  return String(value ?? "")
    .replace(/(?:Bearer|token|secret|password|api[_-]?key)\s*[:=]\s*\S+/gi, "[REDACTED]")
    .slice(0, max);
}

function stableDecisionId(payload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}

function normalizeCandidates(managerAction) {
  const candidates = [
    ...(managerAction?.dispatchPlan?.gated ?? []).map((item) => ({
      id: item.skill,
      kind: "gated",
      objective: boundedText(item.objective),
    })),
    ...(managerAction?.dispatchPlan?.helpers ?? []).map((item) => ({
      id: item.skill,
      kind: "helper",
      objective: boundedText(item.objective),
    })),
  ];
  if (managerAction?.dispatchPlan?.team) {
    candidates.push({
      id: "team",
      kind: "team",
      objective: boundedText(managerAction.dispatchPlan.team.objective),
    });
  }
  if (candidates.length === 0)
    candidates.push({ id: "none", kind: "none", objective: "No action is currently eligible." });
  return candidates;
}

function validateResponse(body, candidateIds) {
  const answer = body?.answers?.maestro_lane;
  const choice = answer?.choice;
  if (!answer || answer.type !== "choice" || typeof choice !== "string") {
    throw new Error("Jev returned no typed maestro_lane choice");
  }
  if (!candidateIds.includes(choice)) {
    throw new Error(`Jev selected an unavailable Maestro action: ${choice}`);
  }
  if (choice !== "team" && choice !== "none" && !safeLanePattern.test(choice)) {
    throw new Error(`Jev selected an invalid Maestro lane: ${choice}`);
  }
  return {
    choice,
    confidence: typeof answer.confidence === "number" ? answer.confidence : null,
    probabilities: answer.probabilities ?? {},
    model: body.model ?? null,
    usage: body.usage ?? null,
  };
}

function deterministicDecision(managerAction) {
  const candidates = normalizeCandidates(managerAction);
  return {
    provider: "deterministic",
    decisionId: stableDecisionId(candidates),
    ...validateDeterministicCandidate(candidates[0]),
    candidates,
  };
}

function validateDeterministicCandidate(candidate) {
  return {
    choice: candidate.id,
    confidence: 1,
    probabilities: { [candidate.id]: 1 },
    model: "local-policy",
    usage: null,
  };
}

export function getMaestroDecisionProviderConfig(env = process.env) {
  return {
    provider: env.MAESTRO_DECISION_PROVIDER ?? "jev",
    apiKey: env.TYPESAFE_API_KEY ?? null,
    endpoint: env.TYPESAFE_ENDPOINT ?? DEFAULT_ENDPOINT,
    model: env.TYPESAFE_DEFAULT_MODEL ?? DEFAULT_MODEL,
    timeoutMs: Number.parseInt(env.TYPESAFE_TIMEOUT_MS ?? `${DEFAULT_TIMEOUT_MS}`, 10),
  };
}

export async function decideMaestroLane({
  releaseState,
  runtimeSummary,
  idea,
  managerAction,
  fetchImpl = globalThis.fetch,
  env = process.env,
} = {}) {
  const config = getMaestroDecisionProviderConfig(env);
  const candidates = normalizeCandidates(managerAction);
  if (config.provider === "deterministic") {
    return deterministicDecision(managerAction);
  }
  if (config.provider !== "jev") {
    throw new Error(`Unsupported Maestro decision provider: ${config.provider}`);
  }
  if (!config.apiKey) {
    throw new Error(
      "Maestro requires TYPESAFE_API_KEY for Jev routing. Set MAESTRO_DECISION_PROVIDER=deterministic only for explicit offline tests.",
    );
  }
  if (typeof fetchImpl !== "function") throw new Error("Fetch is unavailable for Jev routing");

  const state = {
    goal: boundedText(idea, 1_500),
    release: releaseState,
    runtime: {
      pendingMailboxCount: runtimeSummary?.pendingMailboxCount ?? 0,
      invalidArtifacts: runtimeSummary?.invalidArtifacts?.length ?? 0,
      missingArtifacts: runtimeSummary?.missingArtifacts?.length ?? 0,
    },
    eligible_actions: candidates,
  };
  const payload = {
    model: config.model,
    state,
    questions: {
      maestro_lane: {
        type: "choice",
        instructions:
          "Choose the single eligible Meta-Architect action to execute now. Never choose an action outside the provided criteria. Prefer the smallest safe action that advances the task.",
        criteria: Object.fromEntries(
          candidates.map((candidate) => [candidate.id, candidate.objective]),
        ),
      },
    },
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetchImpl(config.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`Jev request failed (${response.status})`);
    const decision = validateResponse(
      body,
      candidates.map((candidate) => candidate.id),
    );
    return {
      provider: "jev",
      decisionId: stableDecisionId(payload),
      candidates,
      ...decision,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function applyMaestroDecision(managerAction, decision) {
  if (decision?.provider === "deterministic") return managerAction;
  if (!decision || decision.choice === "none") {
    return { ...managerAction, dispatchPlan: { helpers: [], gated: [], team: null } };
  }
  const helpers = (managerAction.dispatchPlan?.helpers ?? []).filter(
    (item) => item.skill === decision.choice,
  );
  const gated = (managerAction.dispatchPlan?.gated ?? []).filter(
    (item) => item.skill === decision.choice,
  );
  const team = decision.choice === "team" ? (managerAction.dispatchPlan?.team ?? null) : null;
  return {
    ...managerAction,
    mode: team ? "team" : helpers.length > 0 ? "helper-only" : "helper+gated",
    nextAction: team ? "dispatch-team" : helpers.length > 0 ? "dispatch-helper" : "dispatch-gated",
    dispatchPlan: { helpers, gated, team },
  };
}
