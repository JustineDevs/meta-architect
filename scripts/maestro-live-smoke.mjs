#!/usr/bin/env node

import { decideMaestroLane } from "../src/runtime/maestro-decision-provider.js";
import { getProviderConfigStatus } from "../src/runtime/provider-config.js";

const providerStatus = await getProviderConfigStatus();
if (!providerStatus.configured) {
  throw new Error(
    "A TypeSafe API key is required for the live Maestro smoke test. Run `ma auth typesafe`, add it to .env.local, or use `npm test` for deterministic offline tests.",
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
