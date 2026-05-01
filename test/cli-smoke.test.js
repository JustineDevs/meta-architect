import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const cleanDecisions = {
  schemaVersion: "0.1.0",
  idea_status: "DRAFT",
  architecture_status: "DRAFT",
  evidence_status: "MISSING",
  logic_status: "PENDING",
  security_status: "PENDING",
  experience_status: "PENDING",
  build_status: "LOCKED",
  merge_status: "LOCKED",
  release_status: "LOCKED",
  decisions: [],
};
const cleanRelease = {
  schemaVersion: "0.1.0",
  idea_status: "DRAFT",
  architecture_status: "DRAFT",
  evidence_status: "MISSING",
  logic_status: "PENDING",
  security_status: "PENDING",
  experience_status: "PENDING",
  build_status: "LOCKED",
  merge_status: "LOCKED",
  release_status: "LOCKED",
  waiver: null,
  updatedAt: "2026-04-30T00:00:00.000Z",
};

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (
      entry.name === ".git" ||
      entry.name === "node_modules" ||
      entry.name === ".omx" ||
      entry.name === ".claude" ||
      entry.name === ".agents"
    ) {
      continue;
    }

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

test("ma status succeeds against the default scaffold", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "meta-architect-status-"));
  await copyDir(repoRoot, tempRoot);
  await fs.mkdir(path.join(tempRoot, ".omx"), { recursive: true });
  await fs.writeFile(
    path.join(tempRoot, ".omx", "decisions.json"),
    `${JSON.stringify(cleanDecisions, null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(tempRoot, ".omx", "release.json"),
    `${JSON.stringify(cleanRelease, null, 2)}\n`,
  );
  const result = spawnSync(process.execPath, [path.join(repoRoot, "bin/ma.js"), "status"], {
    cwd: tempRoot,
    env: { ...process.env, MA_ROOT: tempRoot },
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  const release = JSON.parse(
    await fs.readFile(path.join(tempRoot, ".omx", "release.json"), "utf8"),
  );
  assert.equal(release.build_status, "LOCKED");
});

test("ma run $build fails closed against the default scaffold", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "meta-architect-build-"));
  await copyDir(repoRoot, tempRoot);
  await fs.mkdir(path.join(tempRoot, ".omx"), { recursive: true });
  await fs.writeFile(
    path.join(tempRoot, ".omx", "decisions.json"),
    `${JSON.stringify(cleanDecisions, null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(tempRoot, ".omx", "release.json"),
    `${JSON.stringify(cleanRelease, null, 2)}\n`,
  );
  const result = spawnSync(process.execPath, [path.join(repoRoot, "bin/ma.js"), "run", "$build"], {
    cwd: tempRoot,
    env: { ...process.env, MA_ROOT: tempRoot },
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  const decisions = JSON.parse(
    await fs.readFile(path.join(tempRoot, ".omx", "decisions.json"), "utf8"),
  );
  assert.equal(decisions.decisions.at(-1).status, "BLOCKED");
});
