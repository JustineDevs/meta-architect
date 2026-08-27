import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPiMaestroToolAllowed,
  createPiMaestroToolSurface,
  isPiMaestroEnabled,
  runPiMaestroExperimental,
} from "../src/runtime/pi-maestro-core.js";

test("pi-maestro stays opt-in and hard-blocks before tool dispatch", async () => {
  assert.equal(isPiMaestroEnabled({}), false);
  assert.equal(isPiMaestroEnabled({ MA_PI_AGENT_CORE: "1" }), true);
  assert.throws(
    () =>
      assertPiMaestroToolAllowed("$build", {
        buildReadiness: { allowed: false, blockers: ["$vet"] },
      }),
    /\$build blocked: \$vet/,
  );
  const calls = [];
  const surface = createPiMaestroToolSurface({
    runners: { $build: async () => "built" },
    beforeToolCall: async (name) => {
      calls.push(`before:${name}`);
      throw new Error("gate blocked");
    },
  });
  await assert.rejects(() => surface.dispatch("$build"), /gate blocked/);
  assert.deepEqual(calls, ["before:$build"]);
});

test("pi-maestro preserves waiting-review termination and after-tool receipts", async () => {
  const receipts = [];
  const surface = createPiMaestroToolSurface({
    runners: { $arch: async () => ({ status: "APPROVED" }) },
    isWaitingReview: () => true,
    afterToolCall: async (name, result) => receipts.push({ name, result }),
  });
  assert.deepEqual(await surface.dispatch("$arch"), { terminate: true, status: "WAITING_REVIEW" });
  assert.deepEqual(receipts, []);

  const handled = await runPiMaestroExperimental({
    agent: { run: async ({ tools }) => Object.keys(tools) },
    tools: surface.tools,
  });
  assert.deepEqual(handled, { handled: true, result: ["$arch"] });
  const fallback = await runPiMaestroExperimental({ tools: surface.tools });
  assert.equal(fallback.handled, false);
});
