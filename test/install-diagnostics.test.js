import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("installer dry-run reports side effects and undo guidance", () => {
  const result = spawnSync(
    "sh",
    [path.join(root, "scripts/install.sh"), "--dry-run", "--no-setup", "--no-skills"],
    {
      cwd: root,
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /plan/);
  assert.match(result.stdout, /setup: disabled/);
  assert.match(result.stdout, /undo: npm uninstall/);
});

test("versioned installer checksum matches the shipped script", () => {
  const installer = fs.readFileSync(path.join(root, "scripts/install.sh"));
  const expected = fs
    .readFileSync(path.join(root, "scripts/install.sh.sha256"), "utf8")
    .trim()
    .split(/\s+/)[0];
  assert.equal(crypto.createHash("sha256").update(installer).digest("hex"), expected);
});
