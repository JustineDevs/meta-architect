import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  applyMaestroDecision,
  decideMaestroLane,
  getMaestroDecisionProviderConfig,
} from "../src/runtime/maestro-decision-provider.js";

const maestroSkill = await fs.readFile(
  new URL("../skills/maestro/SKILL.md", import.meta.url),
  "utf8",
);

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

test("Maestro does not claim provider usage without runtime evidence", () => {
  assert.match(
    maestroSkill,
    /does not by itself call TypeSafe, Jev, or any other decision provider/,
  );
  assert.match(maestroSkill, /provider use: not verified/);
  assert.match(maestroSkill, /successful.*provider: "jev"/s);
});

test("the generated host prompt distinguishes skill loading from provider use", async () => {
  const prompt = await fs.readFile(
    new URL("../skills/maestro/agents/openai.yaml", import.meta.url),
    "utf8",
  );
  assert.match(prompt, /Loading this prompt does not call TypeSafe or Jev/);
  assert.match(prompt, /successful local Maestro runtime receipt/);
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

test("offline routing dispatches only the selected action when several are eligible", async () => {
  const action = {
    mode: "helper+gated",
    nextAction: "dispatch-gated",
    dispatchPlan: {
      helpers: [{ skill: "$diagnose", objective: "Diagnose the failure" }],
      gated: [{ skill: "$arch", objective: "Approve architecture" }],
      team: null,
    },
  };
  const decision = await decideMaestroLane({
    managerAction: action,
    env: { MAESTRO_DECISION_PROVIDER: "deterministic" },
  });
  const applied = applyMaestroDecision(action, decision);
  assert.equal(decision.choice, "$arch");
  assert.deepEqual(applied.dispatchPlan.helpers, []);
  assert.deepEqual(
    applied.dispatchPlan.gated.map((item) => item.skill),
    ["$arch"],
  );
});

test("Jev routing sends typed choices and rejects choices outside the safe action set", async () => {
  let request;
  const decision = await decideMaestroLane({
    releaseState: { architecture_status: "DRAFT" },
    runtimeSummary: { pendingMailboxCount: 0, invalidArtifacts: [], missingArtifacts: [] },
    idea: "Build a verified feature",
    managerAction,
    instructionContext: [
      { name: "architecture", content: "Use bounded contexts. API_KEY=do-not-send-this-value" },
    ],
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
  assert.equal(request.state.skill_instruction_context[0].name, "architecture");
  assert.match(
    request.state.skill_instruction_context[0].content,
    /\[REDACTED\]|__MA_SECURE_ASSIGNMENT__/,
  );
  assert.doesNotMatch(request.state.skill_instruction_context[0].content, /do-not-send-this-value/);
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

test("Jev routing selects the built-in model when only the credential is configured", async () => {
  let request;
  await decideMaestroLane({
    managerAction,
    env: { TYPESAFE_API_KEY: "jv_live_test" },
    fetchImpl: async (_url, options) => {
      request = JSON.parse(options.body);
      return new Response(
        JSON.stringify({
          model: "jev-latest",
          answers: { maestro_lane: { type: "choice", choice: "$arch" } },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });
  assert.equal(request.model, "jev-latest");
});

test("Jev routing loads a project dotenv credential without process exports", async (t) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ma-jev-dotenv-"));
  t.after(() => fs.rm(cwd, { recursive: true, force: true }));
  await fs.writeFile(path.join(cwd, ".env.local"), "TYPESAFE_API_KEY=jv_live_dotenv\n");

  const decision = await decideMaestroLane({
    managerAction,
    cwd,
    env: {},
    fetchImpl: async (_url, options) => {
      assert.equal(options.headers.Authorization, "Bearer jv_live_dotenv");
      return new Response(
        JSON.stringify({ answers: { maestro_lane: { type: "choice", choice: "$arch" } } }),
        { status: 200 },
      );
    },
  });
  assert.equal(decision.provider, "jev");
  assert.equal(decision.choice, "$arch");
});
