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
      entry.name === ".ma" ||
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

async function writeFakeCodex(tempRoot, exitCode = 0) {
  const codexBin = path.join(tempRoot, "fake-codex.mjs");
  await fs.writeFile(
    codexBin,
    `import fs from "node:fs/promises";

const outputPath = process.env.MA_TEST_OUTPUT;
if (outputPath) {
  await fs.writeFile(
    outputPath,
    JSON.stringify({
      argv: process.argv.slice(2),
    }),
  );
}

process.exit(${exitCode});
`,
  );
  return codexBin;
}

test("ma status succeeds against the default scaffold", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "meta-architect-status-"));
  await copyDir(repoRoot, tempRoot);
  await fs.mkdir(path.join(tempRoot, ".ma"), { recursive: true });
  await fs.writeFile(
    path.join(tempRoot, ".ma", "decisions.json"),
    `${JSON.stringify(cleanDecisions, null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(tempRoot, ".ma", "release.json"),
    `${JSON.stringify(cleanRelease, null, 2)}\n`,
  );
  const result = spawnSync(process.execPath, [path.join(repoRoot, "bin/ma.js"), "status"], {
    cwd: tempRoot,
    env: { ...process.env, MA_ROOT: tempRoot },
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  const release = JSON.parse(await fs.readFile(path.join(tempRoot, ".ma", "release.json"), "utf8"));
  assert.equal(release.build_status, "LOCKED");
});

test("ma run $build fails closed against the default scaffold", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "meta-architect-build-"));
  await copyDir(repoRoot, tempRoot);
  await fs.mkdir(path.join(tempRoot, ".ma"), { recursive: true });
  await fs.writeFile(
    path.join(tempRoot, ".ma", "decisions.json"),
    `${JSON.stringify(cleanDecisions, null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(tempRoot, ".ma", "release.json"),
    `${JSON.stringify(cleanRelease, null, 2)}\n`,
  );
  const result = spawnSync(process.execPath, [path.join(repoRoot, "bin/ma.js"), "run", "$build"], {
    cwd: tempRoot,
    env: { ...process.env, MA_ROOT: tempRoot },
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  const decisions = JSON.parse(
    await fs.readFile(path.join(tempRoot, ".ma", "decisions.json"), "utf8"),
  );
  assert.equal(decisions.decisions.at(-1).status, "BLOCKED");
});

test("ma setup seeds canonical .ma runtime state", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "meta-architect-setup-"));
  await copyDir(repoRoot, tempRoot);
  const result = spawnSync(process.execPath, [path.join(repoRoot, "bin/ma.js"), "setup"], {
    cwd: tempRoot,
    env: { ...process.env, MA_ROOT: tempRoot },
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  const releaseState = JSON.parse(
    await fs.readFile(path.join(tempRoot, ".ma", "release.json"), "utf8"),
  );
  assert.equal(releaseState.build_status, "LOCKED");
  const sourcesState = JSON.parse(
    await fs.readFile(path.join(tempRoot, ".ma", "evidence", "sources.json"), "utf8"),
  );
  assert.deepEqual(sourcesState.items, []);
  await fs.access(path.join(tempRoot, ".ma", "context", "project.md"));
  await fs.access(path.join(tempRoot, ".ma", "specs", "architecture.md"));
  await fs.access(path.join(tempRoot, ".ma", "plans", "implementation.md"));
  await fs.access(path.join(tempRoot, ".ma", "plans", "build.md"));
  await fs.access(path.join(tempRoot, ".ma", "runbook.md"));
});

test("ma launcher delegates non-native commands to codex and strips compatibility flags", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "meta-architect-launcher-"));
  await copyDir(repoRoot, tempRoot);
  const outputPath = path.join(tempRoot, "codex-output.json");
  const codexBin = await writeFakeCodex(tempRoot);
  const result = spawnSync(
    process.execPath,
    [path.join(repoRoot, "bin/ma.js"), "--madmax", "--high", "--model", "gpt-5.4", "hello"],
    {
      cwd: tempRoot,
      env: {
        ...process.env,
        MA_CODEX_BIN: codexBin,
        MA_TEST_OUTPUT: outputPath,
      },
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0);
  const output = JSON.parse(await fs.readFile(outputPath, "utf8"));
  assert.deepEqual(output.argv, ["--model", "gpt-5.4", "hello"]);
});

test("ma with no args delegates directly to codex", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "meta-architect-launcher-empty-"));
  await copyDir(repoRoot, tempRoot);
  const outputPath = path.join(tempRoot, "codex-output.json");
  const codexBin = await writeFakeCodex(tempRoot);
  const result = spawnSync(process.execPath, [path.join(repoRoot, "bin/ma.js")], {
    cwd: tempRoot,
    env: {
      ...process.env,
      MA_CODEX_BIN: codexBin,
      MA_TEST_OUTPUT: outputPath,
    },
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  const output = JSON.parse(await fs.readFile(outputPath, "utf8"));
  assert.deepEqual(output.argv, []);
});

test("ma launcher preserves the delegated codex exit code", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "meta-architect-launcher-exit-"));
  await copyDir(repoRoot, tempRoot);
  const codexBin = await writeFakeCodex(tempRoot, 7);
  const result = spawnSync(process.execPath, [path.join(repoRoot, "bin/ma.js"), "--madmax"], {
    cwd: tempRoot,
    env: {
      ...process.env,
      MA_CODEX_BIN: codexBin,
      MA_TEST_OUTPUT: path.join(tempRoot, "codex-output.json"),
    },
    encoding: "utf8",
  });

  assert.equal(result.status, 7);
});
