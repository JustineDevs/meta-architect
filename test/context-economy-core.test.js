import assert from "node:assert/strict";
import test from "node:test";
import {
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
