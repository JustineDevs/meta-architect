import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createTestNamespace } from "../src/test-fixtures.js";
import { spawnPortable } from "./helpers/spawn-portable.js";

const repoRoot = process.cwd();

async function writeFakeCodex(tempRoot, exitCode = 0) {
  const codexBin = path.join(tempRoot, "fake-codex.mjs");
  await fs.writeFile(
    codexBin,
    `import fs from "node:fs/promises";

const outputPath = process.env.MA_TEST_OUTPUT;
if (outputPath) {
  await fs.writeFile(outputPath, JSON.stringify({ argv: process.argv.slice(2) }));
}

process.exit(${exitCode});
`,
  );
  return codexBin;
}

function assertStdoutContainsIfAvailable(result, pattern) {
  if (result.stdout.trim()) {
    assert.match(result.stdout, pattern);
  }
}

test("packed package installs and supports the documented runtime/helper flow", async () => {
  const tempRoot = createTestNamespace("meta-architect-packaged");
  const installRoot = path.join(tempRoot, "global");
  const workRoot = path.join(tempRoot, "project");
  const codexHome = path.join(tempRoot, "codex-home");
  const outputPath = path.join(tempRoot, "codex-output.json");
  const tarballPath = path.join(tempRoot, "jstn-sdk-ma-0.14.0.tgz");

  await fs.mkdir(installRoot, { recursive: true });
  await fs.mkdir(workRoot, { recursive: true });

  const packResult = spawnSync(
    "npm",
    [
      "pack",
      ".",
      "--ignore-scripts",
      "--cache",
      path.join(tempRoot, ".npm-cache"),
      "--pack-destination",
      tempRoot,
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );
  assert.equal(packResult.status, 0, packResult.stderr || packResult.stdout);
  await fs.access(tarballPath);

  const installResult = spawnSync(
    "npm",
    [
      "install",
      "--prefix",
      installRoot,
      "--cache",
      path.join(tempRoot, ".npm-install-cache"),
      tarballPath,
    ],
    {
      cwd: tempRoot,
      env: {
        ...process.env,
        CODEX_HOME: codexHome,
      },
      encoding: "utf8",
    },
  );
  assert.equal(installResult.status, 0, installResult.stderr || installResult.stdout);

  const maBin = path.join(
    installRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "ma.cmd" : "ma",
  );
  const codexBin = await writeFakeCodex(tempRoot);

  const launchResult = spawnPortable(maBin, ["--madmax", "--high", "--model", "gpt-5.4"], {
    cwd: workRoot,
    env: {
      ...process.env,
      CODEX_HOME: codexHome,
      MA_CODEX_BIN: codexBin,
      MA_TEST_OUTPUT: outputPath,
      PATH: `${path.join(installRoot, "bin")}:${process.env.PATH}`,
    },
    encoding: "utf8",
  });
  assert.equal(launchResult.status, 0, launchResult.stderr || launchResult.stdout);
  const installedSkillNames = ["maestro", "arch", "sage", "flow", "vet", "vibe", "build"];
  for (const skillName of installedSkillNames) {
    await fs.access(path.join(codexHome, "skills", skillName, "SKILL.md"));
  }
  await assert.rejects(fs.access(path.join(codexHome, "skills", "meta-architect", "SKILL.md")));
  const supportManifest = JSON.parse(
    await fs.readFile(path.join(codexHome, "meta-architect-sdk", "asset-manifest.json"), "utf8"),
  );
  assert.equal(supportManifest.schemaVersion, "1.0.0");
  assert.equal(supportManifest.bundleVersion, "0.14.0");
  await fs.access(path.join(codexHome, "skills", "arch", "SKILL.md"));
  await fs.access(path.join(codexHome, "meta-architect-sdk", "templates", "AGENTS.md"));

  const codexOutput = JSON.parse(await fs.readFile(outputPath, "utf8"));
  assert.deepEqual(codexOutput.argv, ["--model", "gpt-5.4"]);

  const setupResult = spawnPortable(maBin, ["setup"], {
    cwd: workRoot,
    env: {
      ...process.env,
      PATH: `${path.join(installRoot, "bin")}:${process.env.PATH}`,
    },
    encoding: "utf8",
  });
  assert.equal(setupResult.status, 0, setupResult.stderr || setupResult.stdout);
  assert.match(
    setupResult.stdout,
    /(created|existing|refreshed): .*scripts\/active-autonomy-hook\.mjs/,
  );

  await fs.access(path.join(workRoot, ".ma", "release.json"));
  await fs.access(path.join(workRoot, ".ma", "decisions.json"));
  await fs.access(path.join(workRoot, ".ma", "skills", "arch.skill.md"));
  await fs.access(path.join(workRoot, ".ma", "context", "project.md"));
  await fs.access(path.join(workRoot, ".ma", "context", "learning-loop-core.json"));
  await fs.access(path.join(workRoot, ".ma", "specs", "architecture.md"));
  await fs.access(path.join(workRoot, ".ma", "plans", "implementation.md"));
  await fs.access(path.join(workRoot, ".ma", "runbook.md"));
  await fs.access(path.join(workRoot, ".ma", "guidance", "merged.json"));
  await fs.access(path.join(workRoot, ".ma", "memory", "notes.md"));
  await fs.access(path.join(workRoot, ".ma", "hooks", "config.json"));
  await fs.access(path.join(workRoot, ".ma", "tasks", "registry.json"));
  await fs.access(path.join(workRoot, ".ma", "workspaces", "index.json"));
  await fs.access(path.join(workRoot, "scripts", "active-autonomy-hook.mjs"));
  await fs.access(path.join(workRoot, "scripts", "context-hydration-hook.mjs"));
  const hookResult = spawnPortable(maBin, ["hook", "context-hydration"], {
    cwd: workRoot,
    env: {
      ...process.env,
      MA_ROOT: workRoot,
      PATH: `${path.join(installRoot, "bin")}:${process.env.PATH}`,
    },
    encoding: "utf8",
  });
  assert.equal(hookResult.status, 0, hookResult.stderr || hookResult.stdout);
  assert.match(hookResult.stdout, /context_hydration/);
  await fs.access(path.join(codexHome, "meta-architect-sdk", "docs", "reference"));

  await fs.writeFile(
    path.join(workRoot, "mcp", "servers.json"),
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

  const helperFlow = [
    ["idea", "Build a packaged install smoke test"],
    ["run", "$maestro"],
    ["status"],
  ];

  for (const command of helperFlow) {
    const result = spawnPortable(maBin, command, {
      cwd: workRoot,
      env: {
        ...process.env,
        MA_DISABLE_LIVE_MCP: "1",
        PATH: `${path.join(installRoot, "bin")}:${process.env.PATH}`,
      },
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }

  const buildResult = spawnPortable(maBin, ["run", "$build"], {
    cwd: workRoot,
    env: {
      ...process.env,
      MA_DISABLE_LIVE_MCP: "1",
      PATH: `${path.join(installRoot, "bin")}:${process.env.PATH}`,
    },
    encoding: "utf8",
  });
  assert.equal(buildResult.status, 1);

  const buildPlan = await fs.readFile(path.join(workRoot, ".ma", "plans", "build.md"), "utf8");
  const maestroPlan = await fs.readFile(path.join(workRoot, ".ma", "plans", "maestro.md"), "utf8");
  const releaseState = JSON.parse(
    await fs.readFile(path.join(workRoot, ".ma", "release.json"), "utf8"),
  );
  const managerRuns = JSON.parse(
    await fs.readFile(path.join(workRoot, ".ma", "state", "manager-runs.json"), "utf8"),
  );
  const maestroState = JSON.parse(
    await fs.readFile(path.join(workRoot, ".ma", "state", "maestro-state.json"), "utf8"),
  );
  const maestroEvents = (
    await fs.readFile(path.join(workRoot, ".ma", "logs", "maestro-events.ndjson"), "utf8")
  )
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const installedMaestroSkill = await fs.readFile(
    path.join(codexHome, "skills", "maestro", "SKILL.md"),
    "utf8",
  );
  assert.match(maestroPlan, /\$arch/);
  assert.match(buildPlan, /LOCKED/);
  assert.equal(releaseState.architecture_status, "APPROVED");
  assert.equal(releaseState.evidence_status, "MISSING");
  assert.equal(releaseState.logic_status, "PENDING");
  assert.equal(managerRuns.runs.length > 0, true);
  assert.equal(maestroState.schemaVersion, "0.1.0");
  assert.equal(maestroEvents.length > 0, true);
  assert.match(installedMaestroSkill, /autonomous/i);
  assert.doesNotMatch(maestroPlan, /\$meta-architect/);

  await fs.rm(tarballPath, { force: true });
});

test("packed package supports the golden-path onboarding flow", async () => {
  const tempRoot = createTestNamespace("meta-architect-onboarding");
  const installRoot = path.join(tempRoot, "global");
  const workRoot = path.join(tempRoot, "project");
  const codexHome = path.join(tempRoot, "codex-home");
  const outputPath = path.join(tempRoot, "codex-output.json");
  const tarballPath = path.join(tempRoot, "jstn-sdk-ma-0.14.0.tgz");

  await fs.mkdir(installRoot, { recursive: true });
  await fs.mkdir(workRoot, { recursive: true });

  const packResult = spawnSync(
    "npm",
    [
      "pack",
      ".",
      "--ignore-scripts",
      "--cache",
      path.join(tempRoot, ".npm-cache"),
      "--pack-destination",
      tempRoot,
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );
  assert.equal(packResult.status, 0, packResult.stderr || packResult.stdout);
  await fs.access(tarballPath);

  const installResult = spawnSync(
    "npm",
    [
      "install",
      "--prefix",
      installRoot,
      "--cache",
      path.join(tempRoot, ".npm-install-cache"),
      tarballPath,
    ],
    {
      cwd: tempRoot,
      env: {
        ...process.env,
        CODEX_HOME: codexHome,
      },
      encoding: "utf8",
    },
  );
  assert.equal(installResult.status, 0, installResult.stderr || installResult.stdout);

  const maBin = path.join(
    installRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "ma.cmd" : "ma",
  );
  const codexBin = await writeFakeCodex(tempRoot);

  const bootstrapResult = spawnPortable(maBin, ["bootstrap", "--init-mcp"], {
    cwd: workRoot,
    env: {
      ...process.env,
      CODEX_HOME: codexHome,
      MA_CODEX_BIN: codexBin,
      PATH: `${path.join(installRoot, "bin")}:${process.env.PATH}`,
    },
    encoding: "utf8",
  });
  assert.equal(bootstrapResult.status, 0, bootstrapResult.stderr || bootstrapResult.stdout);
  assertStdoutContainsIfAvailable(bootstrapResult, /Result: READY/);

  const doctorResult = spawnPortable(maBin, ["doctor"], {
    cwd: workRoot,
    env: {
      ...process.env,
      CODEX_HOME: codexHome,
      MA_CODEX_BIN: codexBin,
      PATH: `${path.join(installRoot, "bin")}:${process.env.PATH}`,
    },
    encoding: "utf8",
  });
  assert.equal(doctorResult.status, 0, doctorResult.stderr || doctorResult.stdout);
  assertStdoutContainsIfAvailable(doctorResult, /Result: READY/);

  const maestroResult = spawnPortable(maBin, ["run", "$maestro"], {
    cwd: workRoot,
    env: {
      ...process.env,
      CODEX_HOME: codexHome,
      MA_CODEX_BIN: codexBin,
      PATH: `${path.join(installRoot, "bin")}:${process.env.PATH}`,
    },
    encoding: "utf8",
  });
  assert.equal(maestroResult.status, 0, maestroResult.stderr || maestroResult.stdout);

  const releaseState = JSON.parse(
    await fs.readFile(path.join(workRoot, ".ma", "release.json"), "utf8"),
  );
  assert.equal(releaseState.build_status, "LOCKED");

  const servers = JSON.parse(await fs.readFile(path.join(workRoot, "mcp", "servers.json"), "utf8"));
  assert.equal(Array.isArray(servers.servers), true);
  assert.equal(servers.servers.length > 0, true);

  const maestroPlan = await fs.readFile(path.join(workRoot, ".ma", "plans", "maestro.md"), "utf8");
  assert.match(maestroPlan, /Best Next Step/);
  assert.match(maestroPlan, /ma idea|\$arch/);
  assert.doesNotMatch(maestroPlan, /\$meta-architect/);

  const codexLaunchResult = spawnPortable(maBin, ["--madmax", "--high", "--model", "gpt-5.4"], {
    cwd: workRoot,
    env: {
      ...process.env,
      CODEX_HOME: codexHome,
      MA_CODEX_BIN: codexBin,
      MA_TEST_OUTPUT: outputPath,
      PATH: `${path.join(installRoot, "bin")}:${process.env.PATH}`,
    },
    encoding: "utf8",
  });
  assert.equal(codexLaunchResult.status, 0, codexLaunchResult.stderr || codexLaunchResult.stdout);

  const codexOutput = JSON.parse(await fs.readFile(outputPath, "utf8"));
  assert.deepEqual(codexOutput.argv, ["--model", "gpt-5.4"]);

  await fs.rm(tarballPath, { force: true });
});
