import assert from "node:assert/strict";
import test from "node:test";
import {
  createCodeGraphTouchpoint,
  createDefaultCodeGraphRehearse,
  createRehearsalTrace,
  extractStaticImports,
  validateCodeGraphRehearse,
} from "../src/runtime/code-graph-rehearse.js";

test("code graph rehearsal stays bounded and read-only", () => {
  const core = validateCodeGraphRehearse(createDefaultCodeGraphRehearse());
  const touchpoint = createCodeGraphTouchpoint("src/runtime/runtime-state.js", [
    "./workspace-virtualizer.js",
  ]);
  const trace = createRehearsalTrace({
    story: "wire workspace virtualizer",
    touchpoints: [touchpoint],
    plannedSteps: Array.from({ length: 14 }, (_, index) => `step-${index + 1}`),
    maxSteps: core.max_steps,
  });

  assert.equal(core.mutation_policy.may_mutate_source, false);
  assert.equal(trace.record_type, "rehearsal_trace");
  assert.equal(trace.truncated, true);
  assert.equal(trace.steps.length, 12);
  assert.equal(trace.source_mutation_allowed, false);
  assert.equal(trace.production_evidence, false);
  assert.deepEqual(trace.does_not_unlock, ["source_mutation", "production_release"]);
});

test("code graph rehearsal extracts static imports for touchpoint previews", () => {
  const imports = extractStaticImports(`
    import fs from "node:fs/promises";
    import { readJson } from "../fs-utils.js";
    export { loadRuntimeSnapshot } from "./runtime-state.js";
    const mod = await import("./dynamic.js");
    const legacy = require("./legacy.cjs");
  `);

  assert.deepEqual(imports, [
    "../fs-utils.js",
    "./dynamic.js",
    "./legacy.cjs",
    "./runtime-state.js",
    "node:fs/promises",
  ]);
});
