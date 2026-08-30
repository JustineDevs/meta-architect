import assert from "node:assert/strict";
import test from "node:test";
import { promisify } from "node:util";
import { assertSafeExecutable, safeExecFile, safeSpawnSync } from "../src/process-utils.js";

test("process boundary rejects shell syntax in executable values", () => {
  assert.throws(() => assertSafeExecutable("node; touch compromised"), /unsafe executable/);
  assert.throws(() => assertSafeExecutable("node\n--version"), /unsafe executable/);
});

test("process boundary passes arguments as argv without enabling a shell", () => {
  const result = safeSpawnSync(
    process.execPath,
    ["-e", "process.stdout.write(process.argv[1])", "$(touch compromised)"],
    {
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "$(touch compromised)");
});

test("process boundary preserves promisified execFile callbacks", async () => {
  const execFileAsync = promisify(safeExecFile);
  const result = await execFileAsync(process.execPath, ["-e", "process.stdout.write('ok')"]);
  assert.equal(result.stdout, "ok");
});
