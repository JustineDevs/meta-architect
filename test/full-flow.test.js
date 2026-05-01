import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

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

test("full documented skill flow reaches build-ready state", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "meta-architect-flow-"));
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

  const previousRoot = process.env.MA_ROOT;
  const previousLive = process.env.MA_DISABLE_LIVE_MCP;
  process.env.MA_ROOT = tempRoot;
  process.env.MA_DISABLE_LIVE_MCP = "1";

  const { runInit, runIdea, runArch, runSage, runFlow, runVet, runVibe } = await import(
    `${pathToFileURL(path.join(repoRoot, "src", "skills.js")).href}?t=${Date.now()}`
  );
  const { loadReleaseState } = await import(
    `${pathToFileURL(path.join(repoRoot, "src", "release-state.js")).href}?t=${Date.now()}`
  );
  const { evaluateBuildGate } = await import(
    `${pathToFileURL(path.join(repoRoot, "src", "build-gate.js")).href}?t=${Date.now()}`
  );

  await runInit();
  await runIdea("Build a demo");
  await runArch();
  await runSage();
  await runFlow();
  await runVet();
  await runVibe();

  const releaseState = await loadReleaseState();
  const evaluation = evaluateBuildGate(releaseState);
  assert.equal(evaluation.allowed, true);

  if (previousRoot === undefined) {
    delete process.env.MA_ROOT;
  } else {
    process.env.MA_ROOT = previousRoot;
  }

  if (previousLive === undefined) {
    delete process.env.MA_DISABLE_LIVE_MCP;
  } else {
    process.env.MA_DISABLE_LIVE_MCP = previousLive;
  }
});
