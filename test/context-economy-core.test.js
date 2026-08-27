import assert from "node:assert/strict";
import test from "node:test";
import {
  createBudgetedContext,
  createContextEconomyPayload,
  createContextEconomyView,
  createDefaultContextEconomyCore,
  createMcpDescriptorEconomy,
  shouldBypassContextEconomy,
  validateContextEconomyCore,
} from "../src/runtime/context-economy-core.js";

test("Context Economy core preserves safety and authority fields", () => {
  const policy = validateContextEconomyCore(createDefaultContextEconomyCore());

  assert.equal(policy.style, "compact_technical");
  assert.equal(policy.evidence_source.repo, "JuliusBrussee/caveman");
  assert.equal(policy.evidence_source.applied_as, "MA Context Economy Core");
  assert.equal(policy.applies_to.includes("$maestro"), true);
  assert.equal(policy.applies_to.includes("team_workers"), true);
  assert.equal(policy.preserve_exact.includes("code_blocks"), true);
  assert.equal(policy.preserve_exact.includes("security_warnings"), true);
  assert.equal(policy.preserve_exact.includes("authority_fields"), true);
  assert.equal(
    policy.compression_rules.some((rule) => rule.includes("auto-clarity bypass")),
    true,
  );
});

test("Context Economy helper compacts plain text but preserves code blocks", () => {
  const view = createContextEconomyView({
    text: "Sure, the auth bug is basically in the middleware.\n```js\nconst token = getToken();\n```",
  });

  assert.equal(view.records_as, "context_budget");
  assert.equal(view.bypassed, false);
  assert.match(view.output, /auth bug is in middleware/);
  assert.match(view.output, /```js\nconst token = getToken\(\);\n```/);
});

test("Context Economy bypasses compression for safety signals", () => {
  const text = "Security warning: this destructive action is irreversible.";

  assert.equal(shouldBypassContextEconomy({ text }), true);
  assert.equal(createContextEconomyView({ text }).output, text);
});

test("Context Economy compacts role payload text while preserving commands and authority fields", () => {
  const payload = createContextEconomyPayload({
    surface: "executor_roles",
    payload: {
      summary: "Sure, the implementation is basically ready and the next step is really testing.",
      command: "npm run release:check",
      authority_boundary: "$maestro_or_owning_lane",
    },
  });

  assert.equal(payload.record_type, "context_economy_payload");
  assert.equal(payload.payload.command, "npm run release:check");
  assert.equal(payload.payload.authority_boundary, "$maestro_or_owning_lane");
  assert.match(payload.payload.summary, /implementation is ready/);
  assert.equal(payload.fields.find((field) => field.key === "summary").compressed, true);
  assert.equal(payload.fields.find((field) => field.key === "command").bypassed, true);
});

test("Context Economy compacts MCP descriptors without mutating schemas", () => {
  const descriptor = createMcpDescriptorEconomy({
    name: "ma_status",
    description: "This tool basically returns the current Meta-Architect status summary.",
    inputSchema: { type: "object", properties: { cwd: { type: "string" } } },
  });

  assert.equal(descriptor.name, "ma_status");
  assert.equal(descriptor.inputSchema.properties.cwd.type, "string");
  assert.match(descriptor.description, /tool returns current Meta-Architect status summary/);
});

test("Context Economy loads ordered bounded context and reports skipped items", () => {
  const result = createBudgetedContext({
    budgetChars: 40,
    topic: "package",
    items: [
      { id: "brief", tier: 1, text: "short brief" },
      { id: "package-map", tier: 2, topic: "package", text: "package commands and tests" },
      { id: "source", tier: 5, topic: "source", text: "large source context that must be skipped" },
    ],
  });
  assert.deepEqual(result.loaded, ["package-map"]);
  assert.equal(result.fallback_expanded, false);
  assert.equal(
    result.skipped.some((item) => item.id === "source"),
    true,
  );
  assert.equal(result.used_chars <= result.budget_chars, true);
});

test("Context Economy falls back to the standard loading order for unknown topics", () => {
  const result = createBudgetedContext({
    budgetChars: 100,
    topic: "missing-subsystem",
    items: [{ id: "brief", tier: 1, text: "agent brief" }],
  });
  assert.equal(result.fallback_expanded, true);
  assert.deepEqual(result.loaded, ["brief"]);
});
