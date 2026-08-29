import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createTestNamespace } from "../src/test-fixtures.js";
import { spawnPortable } from "./helpers/spawn-portable.js";
import { copyProjectFixture as copyDir } from "./helpers/temp-repo.js";
import { listRelativeFiles } from "./helpers/tree-parity.js";

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

async function writeFakeCodexCli(tempRoot) {
  const codexBin = path.join(tempRoot, "fake-codex-cli");
  await fs.writeFile(
    codexBin,
    `#!/usr/bin/env bash
set -euo pipefail

if [ "\${1:-}" = "--version" ]; then
  echo "codex-cli test"
  exit 0
fi

exit 0
`,
    { mode: 0o755 },
  );
  await fs.chmod(codexBin, 0o755);
  return codexBin;
}

function assertStdoutContainsIfAvailable(result, pattern) {
  if (result.stdout.trim()) {
    assert.match(result.stdout, pattern);
  }
}

test("ma status succeeds against the default scaffold", async () => {
  const tempRoot = createTestNamespace("meta-architect-status");
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
  const result = spawnPortable(process.execPath, [path.join(repoRoot, "bin/ma.js"), "status"], {
    cwd: tempRoot,
    env: { ...process.env, MA_ROOT: tempRoot },
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  const release = JSON.parse(await fs.readFile(path.join(tempRoot, ".ma", "release.json"), "utf8"));
  assert.equal(release.build_status, "LOCKED");
});

test("ma status --maestro-view shows scratchpad runtime telemetry", async () => {
  const tempRoot = createTestNamespace("meta-architect-status-maestro");
  await copyDir(repoRoot, tempRoot);
  const outputPath = path.join(tempRoot, "maestro-view.txt");
  const setupResult = spawnPortable(process.execPath, [path.join(repoRoot, "bin/ma.js"), "setup"], {
    cwd: tempRoot,
    env: { ...process.env, MA_ROOT: tempRoot },
    encoding: "utf8",
  });
  assert.equal(setupResult.status, 0, setupResult.stderr || setupResult.stdout);
  const projectIndex = JSON.parse(
    await fs.readFile(path.join(tempRoot, ".ma", "context", "project-index.json"), "utf8"),
  );
  assert.equal(projectIndex.authority, "source_truth");
  assert.equal(projectIndex.record_type, "project_index");

  const result = spawnSync(
    "/bin/sh",
    [
      "-lc",
      `MA_ROOT='${tempRoot}' '${process.execPath}' '${path.join(repoRoot, "bin/ma.js")}' status --maestro-view > '${outputPath}'`,
    ],
    {
      cwd: tempRoot,
      env: {
        ...process.env,
      },
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0);
  const output = await fs.readFile(outputPath, "utf8");
  assert.match(output, /Maestro View/);
  assert.match(output, /Global status:/);
});

test("ma status --json --maestro-view emits one structured lane payload", async () => {
  const tempRoot = createTestNamespace("meta-architect-status-maestro-json");
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
  const setupResult = spawnPortable(process.execPath, [path.join(repoRoot, "bin/ma.js"), "setup"], {
    cwd: tempRoot,
    env: { ...process.env, MA_ROOT: tempRoot },
    encoding: "utf8",
  });
  assert.equal(setupResult.status, 0, setupResult.stderr || setupResult.stdout);
  const result = spawnPortable(
    process.execPath,
    [path.join(repoRoot, "bin/ma.js"), "status", "--json", "--maestro-view"],
    { cwd: tempRoot, env: { ...process.env, MA_ROOT: tempRoot }, encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.scope, "status");
  assert.equal(payload.maestro.scope, "maestro");
  assert.ok(Array.isArray(payload.maestro.tracks));
  assert.ok(Array.isArray(payload.maestro.locks));
  assert.equal(typeof payload.maestro.nextAction, "string");
});

test("ma run $build fails closed against the default scaffold", async () => {
  const tempRoot = createTestNamespace("meta-architect-build");
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
  const result = spawnPortable(
    process.execPath,
    [path.join(repoRoot, "bin/ma.js"), "run", "$build"],
    {
      cwd: tempRoot,
      env: { ...process.env, MA_ROOT: tempRoot },
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 1);
  const decisions = JSON.parse(
    await fs.readFile(path.join(tempRoot, ".ma", "decisions.json"), "utf8"),
  );
  assert.equal(decisions.decisions.at(-1).status, "BLOCKED");
});

test("ma run $build rejects corrupt decisions before rewriting build plan", async () => {
  const tempRoot = createTestNamespace("meta-architect-build-corrupt");
  await copyDir(repoRoot, tempRoot);

  const setupResult = spawnPortable(process.execPath, [path.join(repoRoot, "bin/ma.js"), "setup"], {
    cwd: tempRoot,
    env: { ...process.env, MA_ROOT: tempRoot },
    encoding: "utf8",
  });
  assert.equal(setupResult.status, 0, setupResult.stderr || setupResult.stdout);

  const buildPlanPath = path.join(tempRoot, ".ma", "plans", "build.md");
  const originalBuildPlan = await fs.readFile(buildPlanPath, "utf8");
  await fs.writeFile(path.join(tempRoot, ".ma", "decisions.json"), "{}\n");

  const result = spawnPortable(
    process.execPath,
    [path.join(repoRoot, "bin/ma.js"), "run", "$build"],
    {
      cwd: tempRoot,
      env: { ...process.env, MA_ROOT: tempRoot },
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 1);
  const afterBuildPlan = await fs.readFile(buildPlanPath, "utf8");
  assert.equal(afterBuildPlan, originalBuildPlan);
});

test("ma run $build rejects corrupt release before rewriting build plan", async () => {
  const tempRoot = createTestNamespace("meta-architect-build-corrupt-release");
  await copyDir(repoRoot, tempRoot);

  const setupResult = spawnPortable(process.execPath, [path.join(repoRoot, "bin/ma.js"), "setup"], {
    cwd: tempRoot,
    env: { ...process.env, MA_ROOT: tempRoot },
    encoding: "utf8",
  });
  assert.equal(setupResult.status, 0, setupResult.stderr || setupResult.stdout);

  const buildPlanPath = path.join(tempRoot, ".ma", "plans", "build.md");
  const originalBuildPlan = await fs.readFile(buildPlanPath, "utf8");
  await fs.writeFile(path.join(tempRoot, ".ma", "release.json"), "{not-json");

  const result = spawnPortable(
    process.execPath,
    [path.join(repoRoot, "bin/ma.js"), "run", "$build"],
    {
      cwd: tempRoot,
      env: { ...process.env, MA_ROOT: tempRoot },
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 1);
  const afterBuildPlan = await fs.readFile(buildPlanPath, "utf8");
  assert.equal(afterBuildPlan, originalBuildPlan);
});

test("ma run $build rejects invalid runtime authority before rewriting build plan", async () => {
  const tempRoot = createTestNamespace("meta-architect-build-invalid-authority");
  await copyDir(repoRoot, tempRoot);

  const setupResult = spawnPortable(process.execPath, [path.join(repoRoot, "bin/ma.js"), "setup"], {
    cwd: tempRoot,
    env: { ...process.env, MA_ROOT: tempRoot },
    encoding: "utf8",
  });
  assert.equal(setupResult.status, 0, setupResult.stderr || setupResult.stdout);

  const buildPlanPath = path.join(tempRoot, ".ma", "plans", "build.md");
  const originalBuildPlan = await fs.readFile(buildPlanPath, "utf8");
  await fs.writeFile(
    path.join(tempRoot, ".ma", "tasks", "registry.json"),
    `${JSON.stringify({ schemaVersion: "0.1.0", leader: 42, workers: [], tasks: [] }, null, 2)}\n`,
  );

  const result = spawnPortable(
    process.execPath,
    [path.join(repoRoot, "bin/ma.js"), "run", "$build"],
    {
      cwd: tempRoot,
      env: { ...process.env, MA_ROOT: tempRoot },
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 1);
  const afterBuildPlan = await fs.readFile(buildPlanPath, "utf8");
  assert.equal(afterBuildPlan, originalBuildPlan);
});

test("ma run $build points to runtime repair when runtime-only blockers exist", async () => {
  const tempRoot = createTestNamespace("meta-architect-build-runtime-block");
  await copyDir(repoRoot, tempRoot);

  const setupResult = spawnPortable(process.execPath, [path.join(repoRoot, "bin/ma.js"), "setup"], {
    cwd: tempRoot,
    env: { ...process.env, MA_ROOT: tempRoot },
    encoding: "utf8",
  });
  assert.equal(setupResult.status, 0, setupResult.stderr || setupResult.stdout);

  await fs.writeFile(
    path.join(tempRoot, ".ma", "release.json"),
    `${JSON.stringify(
      {
        schemaVersion: "0.1.0",
        idea_status: "CLEAR",
        architecture_status: "APPROVED",
        evidence_status: "VERIFIED",
        logic_status: "GREEN",
        security_status: "GREEN",
        experience_status: "GREEN",
        build_status: "LOCKED",
        merge_status: "LOCKED",
        release_status: "LOCKED",
        waiver: null,
        updatedAt: "2026-04-30T00:00:00.000Z",
      },
      null,
      2,
    )}\n`,
  );
  await fs.writeFile(path.join(tempRoot, ".ma", "guidance", "merged.json"), "{}\n");

  const result = spawnPortable(
    process.execPath,
    [path.join(repoRoot, "bin/ma.js"), "run", "$build"],
    {
      cwd: tempRoot,
      env: { ...process.env, MA_ROOT: tempRoot },
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 1);
  const buildPlan = await fs.readFile(path.join(tempRoot, ".ma", "plans", "build.md"), "utf8");
  assert.match(buildPlan, /repair runtime artifacts/);
});

test("ma run $maestro executes the next eligible gated work and persists manager state", async () => {
  const tempRoot = createTestNamespace("meta-architect-maestro");
  await copyDir(repoRoot, tempRoot);
  const setupResult = spawnPortable(process.execPath, [path.join(repoRoot, "bin/ma.js"), "setup"], {
    cwd: tempRoot,
    env: { ...process.env, MA_ROOT: tempRoot },
    encoding: "utf8",
  });
  assert.equal(setupResult.status, 0, setupResult.stderr || setupResult.stdout);

  const ideaResult = spawnPortable(
    process.execPath,
    [path.join(repoRoot, "bin/ma.js"), "idea", "Build an autonomous manager smoke test"],
    {
      cwd: tempRoot,
      env: { ...process.env, MA_ROOT: tempRoot },
      encoding: "utf8",
    },
  );
  assert.equal(ideaResult.status, 0, ideaResult.stderr || ideaResult.stdout);

  await fs.writeFile(
    path.join(tempRoot, "mcp", "servers.json"),
    `${JSON.stringify(
      {
        schemaVersion: "0.1.0",
        servers: [
          {
            kind: "gitmcp-evidence",
            category: "meta-list",
            repo: "sindresorhus/awesome",
            endpoint: "https://gitmcp.io/sindresorhus/awesome",
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
  const result = spawnPortable(
    process.execPath,
    [path.join(repoRoot, "bin/ma.js"), "run", "$maestro"],
    {
      cwd: tempRoot,
      env: { ...process.env, MA_DISABLE_LIVE_MCP: "1", MA_ROOT: tempRoot },
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0);
  const releaseState = JSON.parse(
    await fs.readFile(path.join(tempRoot, ".ma", "release.json"), "utf8"),
  );
  const managerRuns = JSON.parse(
    await fs.readFile(path.join(tempRoot, ".ma", "state", "manager-runs.json"), "utf8"),
  );
  const maestroState = JSON.parse(
    await fs.readFile(path.join(tempRoot, ".ma", "state", "maestro-state.json"), "utf8"),
  );

  assert.equal(releaseState.architecture_status, "APPROVED");
  assert.equal(releaseState.evidence_status, "MISSING");
  assert.equal(releaseState.logic_status, "PENDING");
  assert.equal(managerRuns.schemaVersion, "0.1.0");
  assert.equal(managerRuns.runs.length > 0, true);
  assert.equal(maestroState.schemaVersion, "0.1.0");
});

test("ma setup seeds canonical .ma runtime state", async () => {
  const tempRoot = createTestNamespace("meta-architect-setup");
  await copyDir(repoRoot, tempRoot);
  const result = spawnPortable(process.execPath, [path.join(repoRoot, "bin/ma.js"), "setup"], {
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
  await fs.access(path.join(tempRoot, "docs", "qa", "release-issue-gates-0.14.0.json"));
  const runtimeArtifacts = [
    ["guidance", "merged.json"],
    ["memory", "notes.md"],
    ["hooks", "config.json"],
    ["tasks", "registry.json"],
    ["workspaces", "index.json"],
    ["state", "maestro-state.json"],
  ];
  for (const relativePath of runtimeArtifacts) {
    await fs.access(path.join(tempRoot, ".ma", ...relativePath));
  }
  await fs.access(path.join(tempRoot, ".ma", "tasks", "autonomous-queue.json"));
  await fs.access(path.join(tempRoot, "scripts", "active-autonomy-hook.mjs"));
});

test("ma init emits the structured scaffold report", async () => {
  const tempRoot = createTestNamespace("meta-architect-init");
  await copyDir(repoRoot, tempRoot);

  const result = spawnPortable(process.execPath, [path.join(repoRoot, "bin/ma.js"), "init"], {
    cwd: tempRoot,
    env: { ...process.env, MA_ROOT: tempRoot },
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /meta-architect init/);
  assert.match(result.stdout, /(created|existing|refreshed): .*scripts\/active-autonomy-hook\.mjs/);
});

test("ma setup --json reports structured artifact statuses and refreshes drift", async () => {
  const tempRoot = createTestNamespace("meta-architect-setup-json");
  await copyDir(repoRoot, tempRoot);

  const firstResult = spawnPortable(
    process.execPath,
    [path.join(repoRoot, "bin/ma.js"), "setup", "--json"],
    {
      cwd: tempRoot,
      env: { ...process.env, MA_ROOT: tempRoot },
      encoding: "utf8",
    },
  );
  assert.equal(firstResult.status, 0, firstResult.stderr || firstResult.stdout);

  const firstReport = JSON.parse(firstResult.stdout);
  assert.equal(Array.isArray(firstReport.directories), true);
  assert.equal(Array.isArray(firstReport.files), true);
  assert.equal(
    firstReport.files.some((entry) => entry.path === "scripts/active-autonomy-hook.mjs"),
    true,
  );

  await fs.writeFile(path.join(tempRoot, ".codex", "hooks.json"), '{"broken":true}\n');

  const protectedResult = spawnPortable(
    process.execPath,
    [path.join(repoRoot, "bin/ma.js"), "setup", "--json"],
    {
      cwd: tempRoot,
      env: { ...process.env, MA_ROOT: tempRoot },
      encoding: "utf8",
    },
  );

  assert.equal(protectedResult.status, 0, protectedResult.stderr || protectedResult.stdout);
  const protectedReport = JSON.parse(protectedResult.stdout);
  assert.equal(
    protectedReport.files.some(
      (entry) => entry.path === ".codex/hooks.json" && entry.status === "skipped",
    ),
    true,
  );
  assert.equal(
    await fs.readFile(path.join(tempRoot, ".codex", "hooks.json"), "utf8"),
    '{"broken":true}\n',
  );

  const secondResult = spawnPortable(
    process.execPath,
    [path.join(repoRoot, "bin/ma.js"), "setup", "--json", "--refresh"],
    {
      cwd: tempRoot,
      env: { ...process.env, MA_ROOT: tempRoot },
      encoding: "utf8",
    },
  );
  assert.equal(secondResult.status, 0, secondResult.stderr || secondResult.stdout);
  const secondReport = JSON.parse(secondResult.stdout);
  assert.equal(
    secondReport.files.some(
      (entry) => entry.path === ".codex/hooks.json" && entry.status === "refreshed",
    ),
    true,
  );
});

test("ma bootstrap repairs packaged assets and local scaffold for a new checkout", async () => {
  const tempRoot = createTestNamespace("meta-architect-bootstrap");
  const codexHome = path.join(tempRoot, "codex-home");
  await copyDir(repoRoot, tempRoot);
  const codexBin = await writeFakeCodexCli(tempRoot);
  const result = spawnPortable(process.execPath, [path.join(repoRoot, "bin/ma.js"), "bootstrap"], {
    cwd: tempRoot,
    env: {
      ...process.env,
      CODEX_HOME: codexHome,
      MA_CODEX_BIN: codexBin,
      MA_ROOT: tempRoot,
    },
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assertStdoutContainsIfAvailable(result, /Meta-Architect Bootstrap/);
  assertStdoutContainsIfAvailable(result, /Result: READY/);
  await fs.access(path.join(codexHome, "skills", "maestro", "SKILL.md"));
  await assert.rejects(fs.access(path.join(codexHome, "skills", "meta-architect", "SKILL.md")));
  await fs.access(path.join(codexHome, "meta-architect-sdk", "mcp", "servers.json"));
  await fs.access(path.join(codexHome, "meta-architect-sdk", "docs", "README.md"));
  await fs.access(
    path.join(
      codexHome,
      "meta-architect-sdk",
      "plugins",
      "meta-architect",
      "skills",
      "maestro",
      "references",
      "core-release-rules.md",
    ),
  );
  const installedSkillFiles = await listRelativeFiles(path.join(codexHome, "skills"));
  const mirroredPluginSkillFiles = await listRelativeFiles(
    path.join(codexHome, "meta-architect-sdk", "plugins", "meta-architect", "skills"),
  );
  assert.deepEqual(
    mirroredPluginSkillFiles,
    installedSkillFiles.filter((relativePath) => relativePath !== "index.json"),
  );
  await fs.access(path.join(tempRoot, ".ma", "release.json"));
  await fs.access(path.join(tempRoot, ".ma", "context", "project.md"));
});

test("ma bootstrap --init-mcp seeds starter MCP files when local MCP config is empty", async () => {
  const tempRoot = createTestNamespace("meta-architect-bootstrap-mcp");
  const codexHome = path.join(tempRoot, "codex-home");
  await copyDir(repoRoot, tempRoot);
  const codexBin = await writeFakeCodexCli(tempRoot);

  await fs.writeFile(
    path.join(tempRoot, "mcp", "servers.json"),
    `${JSON.stringify({ schemaVersion: "0.1.0", servers: [] }, null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(tempRoot, "mcp", "collections.json"),
    `${JSON.stringify({ schemaVersion: "0.1.0", collections: {} }, null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(tempRoot, "mcp", "fallback.json"),
    `${JSON.stringify(
      {
        schemaVersion: "0.1.0",
        fallback: {
          endpoint: "https://gitmcp.io/docs",
          policy: "Use only when no approved exact endpoint exists.",
        },
      },
      null,
      2,
    )}\n`,
  );

  const result = spawnPortable(
    process.execPath,
    [path.join(repoRoot, "bin/ma.js"), "bootstrap", "--init-mcp"],
    {
      cwd: tempRoot,
      env: {
        ...process.env,
        CODEX_HOME: codexHome,
        MA_CODEX_BIN: codexBin,
        MA_ROOT: tempRoot,
      },
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assertStdoutContainsIfAvailable(
    result,
    /package-owned mcp\/local-capabilities\.json is ready for first-party capabilities/i,
  );
  const servers = JSON.parse(await fs.readFile(path.join(tempRoot, "mcp", "servers.json"), "utf8"));
  assert.equal(servers.servers.length > 0, true);
});

test("ma doctor reports a ready environment after bootstrap", async () => {
  const tempRoot = createTestNamespace("meta-architect-doctor");
  const codexHome = path.join(tempRoot, "codex-home");
  await copyDir(repoRoot, tempRoot);
  const codexBin = await writeFakeCodexCli(tempRoot);

  const bootstrapResult = spawnPortable(
    process.execPath,
    [path.join(repoRoot, "bin/ma.js"), "bootstrap"],
    {
      cwd: tempRoot,
      env: {
        ...process.env,
        CODEX_HOME: codexHome,
        MA_CODEX_BIN: codexBin,
        MA_ROOT: tempRoot,
      },
      encoding: "utf8",
    },
  );
  assert.equal(bootstrapResult.status, 0, bootstrapResult.stderr || bootstrapResult.stdout);

  const doctorResult = spawnPortable(
    process.execPath,
    [path.join(repoRoot, "bin/ma.js"), "doctor"],
    {
      cwd: tempRoot,
      env: {
        ...process.env,
        CODEX_HOME: codexHome,
        MA_CODEX_BIN: codexBin,
        MA_ROOT: tempRoot,
      },
      encoding: "utf8",
    },
  );

  assert.equal(doctorResult.status, 0, doctorResult.stderr || doctorResult.stdout);
  assertStdoutContainsIfAvailable(doctorResult, /Meta-Architect Doctor/);
  assertStdoutContainsIfAvailable(doctorResult, /MCP client version:/);
  assertStdoutContainsIfAvailable(doctorResult, /Result: READY/);
  assertStdoutContainsIfAvailable(doctorResult, /project context freshness/);
  assertStdoutContainsIfAvailable(doctorResult, /MCP context resources/);

  const hooksPath = path.join(tempRoot, ".codex", "hooks.json");
  const hooks = JSON.parse(await fs.readFile(hooksPath, "utf8"));
  hooks.hooks.UserPromptSubmit.push({
    type: "command",
    command: "node ./scripts/missing-hook.mjs",
  });
  await fs.writeFile(hooksPath, `${JSON.stringify(hooks, null, 2)}\n`);
  const brokenHookDoctor = spawnPortable(
    process.execPath,
    [path.join(repoRoot, "bin/ma.js"), "doctor"],
    {
      cwd: tempRoot,
      env: {
        ...process.env,
        CODEX_HOME: codexHome,
        MA_CODEX_BIN: codexBin,
        MA_ROOT: tempRoot,
      },
      encoding: "utf8",
    },
  );
  assert.equal(brokenHookDoctor.status, 0, brokenHookDoctor.stderr || brokenHookDoctor.stdout);
  assertStdoutContainsIfAvailable(brokenHookDoctor, /hook command portability: missing/);
});

test("ma welcome prints bounded onboarding next steps", async () => {
  const result = spawnPortable(process.execPath, [path.join(repoRoot, "bin/ma.js"), "welcome"], {
    cwd: repoRoot,
    env: { ...process.env, MA_ROOT: repoRoot },
    encoding: "utf8",
  });
  assertStdoutContainsIfAvailable(result, /Meta-Architect welcome|ma doctor/);
});

test("ma launcher delegates non-native commands to codex and strips compatibility flags", async () => {
  const tempRoot = createTestNamespace("meta-architect-launcher");
  const codexHome = path.join(tempRoot, "codex-home");
  await copyDir(repoRoot, tempRoot);
  const outputPath = path.join(tempRoot, "codex-output.json");
  const codexBin = await writeFakeCodex(tempRoot);
  const result = spawnPortable(
    process.execPath,
    [path.join(repoRoot, "bin/ma.js"), "--madmax", "--high", "--model", "gpt-5.4", "hello"],
    {
      cwd: tempRoot,
      env: {
        ...process.env,
        CODEX_HOME: codexHome,
        MA_CODEX_BIN: codexBin,
        MA_TEST_OUTPUT: outputPath,
      },
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0);
  await fs.access(path.join(codexHome, "skills", "arch", "SKILL.md"));
  await fs.access(path.join(codexHome, "skills", "vibe", "SKILL.md"));
  await fs.access(path.join(codexHome, "meta-architect-sdk", "mcp", "servers.json"));
  await fs.access(path.join(codexHome, "meta-architect-sdk", "templates", "AGENTS.md"));
  const output = JSON.parse(await fs.readFile(outputPath, "utf8"));
  assert.deepEqual(output.argv, ["--model", "gpt-5.4", "hello"]);
});

test("ma launcher delegates non-native commands to the selected MA_AGENT host", async () => {
  const tempRoot = createTestNamespace("meta-architect-selected-agent");
  await copyDir(repoRoot, tempRoot);
  const outputPath = path.join(tempRoot, "agent-output.json");
  const agentBin = await writeFakeCodex(tempRoot);
  const result = spawnPortable(process.execPath, [path.join(repoRoot, "bin/ma.js"), "hello"], {
    cwd: tempRoot,
    env: {
      ...process.env,
      MA_AGENT: "claude-code",
      MA_CLAUDE_CODE_BIN: agentBin,
      MA_TEST_OUTPUT: outputPath,
      MA_SKIP_AUTO_INSTALL: "1",
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(await fs.readFile(outputPath, "utf8")).argv, ["hello"]);
  assert.deepEqual(
    JSON.parse(await fs.readFile(path.join(tempRoot, ".ma", "prelaunch.json"), "utf8")),
    { schemaVersion: "0.1.0", scope: "project", targets: ["claude-code"] },
  );
  await fs.access(path.join(tempRoot, ".agents", "skills", "meta-architect", "SKILL.md"));
});

test("ma installs but does not launch an installation-only IDE target", async () => {
  const tempRoot = createTestNamespace("meta-architect-install-only-agent");
  const result = spawnPortable(process.execPath, [path.join(repoRoot, "bin/ma.js"), "hello"], {
    cwd: tempRoot,
    env: {
      ...process.env,
      MA_AGENT: "antigravity",
      MA_SKIP_AUTO_INSTALL: "1",
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout.toString(), /delegation was skipped/);
  assert.deepEqual(
    JSON.parse(await fs.readFile(path.join(tempRoot, ".ma", "prelaunch.json"), "utf8")),
    { schemaVersion: "0.1.0", scope: "project", targets: ["antigravity"] },
  );
  await fs.access(path.join(tempRoot, ".agents", "skills", "meta-architect", "SKILL.md"));
});

test("ma sdk-path prints the installed support bundle root", async () => {
  const tempRoot = createTestNamespace("meta-architect-sdk-path");
  const codexHome = path.join(tempRoot, "codex-home");
  const outputPath = path.join(tempRoot, "sdk-path.txt");
  const result = spawnSync(
    "/bin/sh",
    [
      "-lc",
      `CODEX_HOME='${codexHome}' '${process.execPath}' '${path.join(repoRoot, "bin/ma.js")}' sdk-path > '${outputPath}'`,
    ],
    {
      cwd: tempRoot,
      env: {
        ...process.env,
      },
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0);
  assert.equal(
    (await fs.readFile(outputPath, "utf8")).trim(),
    path.join(codexHome, "meta-architect-sdk"),
  );
});

test("ma with no args delegates directly to codex", async () => {
  const tempRoot = createTestNamespace("meta-architect-launcher-empty");
  const codexHome = path.join(tempRoot, "codex-home");
  await copyDir(repoRoot, tempRoot);
  const outputPath = path.join(tempRoot, "codex-output.json");
  const codexBin = await writeFakeCodex(tempRoot);
  const result = spawnPortable(process.execPath, [path.join(repoRoot, "bin/ma.js")], {
    cwd: tempRoot,
    env: {
      ...process.env,
      CODEX_HOME: codexHome,
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
  const tempRoot = createTestNamespace("meta-architect-launcher-exit");
  const codexHome = path.join(tempRoot, "codex-home");
  await copyDir(repoRoot, tempRoot);
  const codexBin = await writeFakeCodex(tempRoot, 7);
  const result = spawnPortable(process.execPath, [path.join(repoRoot, "bin/ma.js"), "--madmax"], {
    cwd: tempRoot,
    env: {
      ...process.env,
      CODEX_HOME: codexHome,
      MA_CODEX_BIN: codexBin,
      MA_TEST_OUTPUT: path.join(tempRoot, "codex-output.json"),
    },
    encoding: "utf8",
  });

  assert.equal(result.status, 7);
});

test("ma verify --architect uses the configured external architect reviewer", async () => {
  const tempRoot = createTestNamespace("meta-architect-architect-verify");
  const outputPath = path.join(tempRoot, "architect-verify.txt");
  const reviewerScript = path.join(tempRoot, "fake-architect-review.sh");
  await copyDir(repoRoot, tempRoot);
  await fs.writeFile(
    reviewerScript,
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s' '{"verdict":"APPROVED","reviewer":"fake-architect","summary":"approved with sk-1234567890123456 for alice@example.com","findings":[]}' > "$MA_ARCHITECT_REVIEW_OUTPUT"
`,
    { mode: 0o755 },
  );
  const setupResult = spawnPortable(process.execPath, [path.join(repoRoot, "bin/ma.js"), "setup"], {
    cwd: tempRoot,
    env: { ...process.env, MA_ROOT: tempRoot },
    encoding: "utf8",
  });
  assert.equal(setupResult.status, 0, setupResult.stderr || setupResult.stdout);

  const result = spawnSync(
    process.execPath,
    [path.join(repoRoot, "bin/ma.js"), "verify", "--architect"],
    {
      cwd: tempRoot,
      env: {
        ...process.env,
        MA_ROOT: tempRoot,
        MA_ARCHITECT_REVIEW_CMD: reviewerScript,
        MA_ARCHITECT_REVIEW_ALLOWLIST: reviewerScript,
      },
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  await fs.writeFile(outputPath, result.stdout);
  const output = await fs.readFile(outputPath, "utf8");
  assert.match(output, /Architect verdict: APPROVED/);
  const persistedReview = await fs.readFile(
    path.join(tempRoot, ".ma", "state", "architect-review.json"),
    "utf8",
  );
  assert.doesNotMatch(persistedReview, /sk-1234567890123456|alice@example\.com/);
  assert.match(persistedReview, /__MA_SECURE_TOKEN__/);
});
