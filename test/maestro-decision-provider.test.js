import assert from "node:assert/strict";
import test from "node:test";
import {
  applyMaestroDecision,
  decideMaestroLane,
  getMaestroDecisionProviderConfig,
} from "../src/runtime/maestro-decision-provider.js";

const managerAction = {
  mode: "helper+gated",
  nextAction: "dispatch-gated",
  dispatchPlan: {
    helpers: [],
    gated: [{ skill: "$arch", objective: "Approve architecture" }],
    team: null,
  },
};

test("Maestro defaults to the Jev provider and reads the server-side API key", () => {
  assert.deepEqual(getMaestroDecisionProviderConfig({}), {
    provider: "jev",
    apiKey: null,
    endpoint: "https://api.typesafe.ai/v1/systemone",
    model: "jev-latest",
    timeoutMs: 10_000,
  });
});

test("offline routing is explicit and constrained to the eligible action", async () => {
  const decision = await decideMaestroLane({
    releaseState: {},
    runtimeSummary: {},
    idea: "test",
    managerAction,
    env: { MAESTRO_DECISION_PROVIDER: "deterministic" },
  });
  assert.equal(decision.provider, "deterministic");
  assert.equal(decision.choice, "$arch");
  assert.equal(applyMaestroDecision(managerAction, decision).dispatchPlan.gated[0].skill, "$arch");
});

test("Jev routing sends typed choices and rejects choices outside the safe action set", async () => {
  let request;
  const decision = await decideMaestroLane({
    releaseState: { architecture_status: "DRAFT" },
    runtimeSummary: { pendingMailboxCount: 0, invalidArtifacts: [], missingArtifacts: [] },
    idea: "Build a verified feature",
    managerAction,
    env: { TYPESAFE_API_KEY: "jv_live_test", TYPESAFE_DEFAULT_MODEL: "jev-1.13.0" },
    fetchImpl: async (_url, options) => {
      request = JSON.parse(options.body);
      return new Response(
        JSON.stringify({
          model: "jev-1.13.0",
          answers: {
            maestro_lane: {
              type: "choice",
              choice: "$arch",
              confidence: 0.98,
              probabilities: { $arch: 0.98 },
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });
  assert.equal(decision.provider, "jev");
  assert.equal(decision.choice, "$arch");
  assert.equal(request.questions.maestro_lane.type, "choice");
  assert.deepEqual(Object.keys(request.questions.maestro_lane.criteria), ["$arch"]);
  await assert.rejects(
    decideMaestroLane({
      releaseState: {},
      runtimeSummary: {},
      managerAction,
      env: { TYPESAFE_API_KEY: "jv_live_test" },
      fetchImpl: async () =>
        new Response(
          JSON.stringify({ answers: { maestro_lane: { type: "choice", choice: "$build" } } }),
          { status: 200 },
        ),
    }),
    /unavailable Maestro action/,
  );
});
