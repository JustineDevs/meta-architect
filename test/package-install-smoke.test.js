import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

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

test("packed package installs and supports the documented runtime/helper flow", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "meta-architect-packaged-"));
  const installRoot = path.join(tempRoot, "global");
  const workRoot = path.join(tempRoot, "project");
  const codexHome = path.join(tempRoot, "codex-home");
  const outputPath = path.join(tempRoot, "codex-output.json");
  const tarballPath = path.join(tempRoot, "jstn-sdk-meta-architect-0.1.1.tgz");

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

  await fs.access(path.join(codexHome, "skills", "meta-architect", "SKILL.md"));
  await fs.access(path.join(codexHome, "skills", "arch", "SKILL.md"));
  await fs.access(path.join(codexHome, "skills", "sage", "SKILL.md"));
  await fs.access(path.join(codexHome, "skills", "flow", "SKILL.md"));
  await fs.access(path.join(codexHome, "skills", "vet", "SKILL.md"));
  await fs.access(path.join(codexHome, "skills", "vibe", "SKILL.md"));
  await fs.access(path.join(codexHome, "skills", "build", "SKILL.md"));

  const maBin = path.join(
    installRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "ma.cmd" : "ma",
  );
  const codexBin = await writeFakeCodex(tempRoot);

  const launchResult = spawnSync(maBin, ["--madmax", "--high", "--model", "gpt-5.4"], {
    cwd: workRoot,
    env: {
      ...process.env,
      MA_CODEX_BIN: codexBin,
      MA_TEST_OUTPUT: outputPath,
      PATH: `${path.join(installRoot, "bin")}:${process.env.PATH}`,
    },
    encoding: "utf8",
  });
  assert.equal(launchResult.status, 0, launchResult.stderr || launchResult.stdout);

  const codexOutput = JSON.parse(await fs.readFile(outputPath, "utf8"));
  assert.deepEqual(codexOutput.argv, ["--model", "gpt-5.4"]);

  const setupResult = spawnSync(maBin, ["setup"], {
    cwd: workRoot,
    env: {
      ...process.env,
      PATH: `${path.join(installRoot, "bin")}:${process.env.PATH}`,
    },
    encoding: "utf8",
  });
  assert.equal(setupResult.status, 0, setupResult.stderr || setupResult.stdout);

  await fs.access(path.join(workRoot, ".ma", "release.json"));
  await fs.access(path.join(workRoot, ".ma", "decisions.json"));
  await fs.access(path.join(workRoot, ".ma", "skills", "arch.skill.md"));

  await fs.writeFile(
    path.join(workRoot, "mcp", "servers.json"),
    `${JSON.stringify(
      {
        schemaVersion: "0.1.0",
        servers: [
          {
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
    ["run", "$arch"],
    ["run", "$sage"],
    ["run", "$flow"],
    ["run", "$vet"],
    ["run", "$vibe"],
    ["status"],
    ["run", "$build"],
  ];

  for (const command of helperFlow) {
    const result = spawnSync(maBin, command, {
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

  await fs.rm(tarballPath, { force: true });
});
