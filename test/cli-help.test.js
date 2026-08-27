import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

test("CLI exposes standard help, version, and command help", async () => {
  const cli = "bin/ma.js";
  const help = await execFileAsync(process.execPath, [cli, "--help"], { encoding: "utf8" });
  assert.match(help.stdout, /Usage: ma <command>/);
  assert.match(help.stdout, /ma doctor \[--json\]/);

  const version = await execFileAsync(process.execPath, [cli, "--version"], { encoding: "utf8" });
  assert.match(version.stdout.trim(), /^\d+\.\d+\.\d+/);

  const commandHelp = await execFileAsync(process.execPath, [cli, "setup", "--help"], {
    encoding: "utf8",
  });
  assert.match(commandHelp.stdout, /ma setup/);
});
