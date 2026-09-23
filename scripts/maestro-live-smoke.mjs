#!/usr/bin/env node

import { decideMaestroLane } from "../src/runtime/maestro-decision-provider.js";

if (!process.env.TYPESAFE_API_KEY) {
  throw new Error(
    "TYPESAFE_API_KEY is required for the live Maestro smoke test. Use `npm test` for deterministic offline tests.",
  );
}

const managerAction = {
  mode: "helper+gated",
  nextAction: "dispatch-gated",
  dispatchPlan: {
    helpers: [],
    gated: [{ skill: "$arch", objective: "Validate the live Maestro decision path." }],
    team: null,
  },
};

const decision = await decideMaestroLane({
  releaseState: { architecture_status: "DRAFT" },
  runtimeSummary: { pendingMailboxCount: 0, invalidArtifacts: [], missingArtifacts: [] },
  idea: "Run a live production-readiness decision smoke test.",
  managerAction,
});

if (decision.provider !== "jev" || decision.choice !== "$arch") {
  throw new Error("Live Maestro smoke test returned an unexpected provider or lane.");
}

console.log(
  JSON.stringify(
    {
      provider: decision.provider,
      model: decision.model,
      decisionId: decision.decisionId,
      choice: decision.choice,
      verified: true,
    },
    null,
    2,
  ),
);
