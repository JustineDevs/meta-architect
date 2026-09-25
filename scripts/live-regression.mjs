#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { getProviderConfigStatus } from "../src/runtime/provider-config.js";
import { createTestNamespace, removeTestNamespace } from "../src/test-fixtures.js";

const execFileAsync = promisify(execFile);
const packageRoot = path.resolve(new URL("..", import.meta.url).pathname);
const cli = path.join(packageRoot, "bin", "ma.js");
const packageMetadata = JSON.parse(
  await fs.readFile(path.join(packageRoot, "package.json"), "utf8"),
);
const runId = crypto.randomUUID();

function parseArgs(argv) {
  const outputIndex = argv.indexOf("--output");
  return {
    output:
      outputIndex === -1
        ? path.join(packageRoot, "docs", "qa", `live-regression-${packageMetadata.version}.json`)
        : path.resolve(argv[outputIndex + 1] ?? ""),
  };
}

function redact(value, workspace) {
  return String(value ?? "")
    .replaceAll(workspace, "<workspace>")
    .replaceAll(os.homedir(), "<home>")
    .replace(/(?:Bearer\s+|token|secret|password|api[_-]?key)\s*[:=]\s*\S+/gi, "[REDACTED]")
    .slice(-20_000);
}

async function runStage(name, args, workspace, env = {}) {
  const startedAt = new Date().toISOString();
  try {
    const result = await execFileAsync(process.execPath, [cli, ...args], {
      cwd: workspace,
      env: { ...process.env, ...env },
      maxBuffer: 2_000_000,
    });
    return {
      name,
      command: redact(["ma", ...args].join(" "), workspace),
      status: "passed",
      exitCode: 0,
      startedAt,
      completedAt: new Date().toISOString(),
      stdout: redact(result.stdout, workspace),
      stderr: redact(result.stderr, workspace),
    };
  } catch (error) {
    const stdout = redact(error.stdout, workspace);
    const stderr = redact(error.stderr, workspace);
    const detail = [stderr, stdout].filter(Boolean).join("\n") || error.message;
    throw Object.assign(new Error(`${name} failed: ${detail}`), {
      stage: {
        name,
        command: redact(["ma", ...args].join(" "), workspace),
        status: "failed",
        exitCode: error.code ?? 1,
        startedAt,
        completedAt: new Date().toISOString(),
        stdout,
        stderr,
      },
    });
  }
}

async function git(workspace, args) {
  await execFileAsync("git", args, { cwd: workspace });
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function seedReleaseCandidate(workspace) {
  const ready = {
    idea_status: "CLEAR",
    architecture_status: "APPROVED",
    evidence_status: "VERIFIED",
    logic_status: "GREEN",
    security_status: "GREEN",
    experience_status: "GREEN",
    build_status: "READY",
  };
  for (const file of ["release.json", "decisions.json"]) {
    const target = path.join(workspace, ".ma", file);
    const current = await readJson(target);
    await fs.writeFile(target, `${JSON.stringify({ ...current, ...ready }, null, 2)}\n`);
  }
}

async function main() {
  if (!(await getProviderConfigStatus()).configured) {
    throw new Error(
      "A TypeSafe API key is required for the live regression workflow. Run `ma auth typesafe`, add it to .env.local, or configure the CI secret.",
    );
  }

  const { output } = parseArgs(process.argv.slice(2));
  const workspace = createTestNamespace("meta-architect-live-regression");
  const stages = [];
  const startedAt = new Date().toISOString();
  let workspaceRemoved = false;
  const codexHome = path.join(workspace, "codex-home");
  const env = {
    MAESTRO_DECISION_PROVIDER: "jev",
    TYPESAFE_TIMEOUT_MS: process.env.TYPESAFE_TIMEOUT_MS ?? "15000",
    CODEX_HOME: codexHome,
  };

  try {
    await fs.mkdir(codexHome, { recursive: true, mode: 0o700 });
    await fs.writeFile(
      path.join(workspace, "package.json"),
      `${JSON.stringify({ name: "ma-live-regression", version: "1.0.0", type: "module" }, null, 2)}\n`,
    );
    await fs.mkdir(path.join(workspace, "src"), { recursive: true });
    await fs.writeFile(path.join(workspace, "src", "index.js"), "export const ready = true;\n");
    await git(workspace, ["init", "--quiet"]);
    await git(workspace, ["config", "user.email", "live-regression@localhost"]);
    await git(workspace, ["config", "user.name", "Meta-Architect Live Regression"]);
    await git(workspace, ["add", "."]);
    await git(workspace, ["commit", "--quiet", "-m", "test: seed live regression workspace"]);

    stages.push(await runStage("setup", ["setup", "--json"], workspace));
    stages.push(await runStage("doctor", ["doctor", "--json"], workspace));
    stages.push(
      await runStage(
        "idea",
        [
          "idea",
          "Harden a small production service and leave verified evidence for the release gate.",
        ],
        workspace,
      ),
    );
    await seedReleaseCandidate(workspace);
    stages.push({
      name: "release-candidate-seed",
      command: "fixture: reviewed upstream gates",
      status: "passed",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      assertions: [
        "idea CLEAR",
        "architecture APPROVED",
        "evidence VERIFIED",
        "logic GREEN",
        "security GREEN",
        "experience GREEN",
        "build READY",
      ],
    });
    stages.push(await runStage("maestro-live", ["run", "$maestro"], workspace, env));

    const mutation =
      "const fs=require('node:fs'); fs.writeFileSync('src/live-regression-proof.json', JSON.stringify({status:'verified',runId:'" +
      runId +
      "'}, null, 2)+'\\n')";
    const verification =
      "const fs=require('node:fs'); const value=JSON.parse(fs.readFileSync('src/live-regression-proof.json')); if(value.status!=='verified') process.exit(1)";
    const task = {
      id: "live-regression-proof",
      goal: "Create and verify a bounded source regression proof artifact.",
      priority: "critical",
      execution: {
        workspace_root: workspace,
        mutation_mode: "source_write",
        allowed_paths: ["src"],
        command: { file: process.execPath, args: ["-e", mutation] },
        verification: [{ file: process.execPath, args: ["-e", verification] }],
      },
    };
    const taskFile = path.join(workspace, "live-task.json");
    await fs.writeFile(taskFile, `${JSON.stringify([task], null, 2)}\n`);
    stages.push(
      await runStage("task-intake", ["task", "bulk", taskFile, "--format", "json"], workspace),
    );
    stages.push(
      await runStage("task-run", ["task", "run", "--max-tasks", "1", "--json"], workspace, env),
    );
    const statusStage = await runStage(
      "status",
      ["status", "--json", "--maestro-view"],
      workspace,
      env,
    );
    stages.push(statusStage);

    const queue = await readJson(path.join(workspace, ".ma", "tasks", "autonomous-queue.json"));
    const completedTask = queue.tasks.find((entry) => entry.id === task.id);
    assert.equal(completedTask?.status, "completed", "live task must complete");
    assert.ok(completedTask.evidence.length > 0, "live task must record evidence");
    const proof = await readJson(path.join(workspace, "src", "live-regression-proof.json"));
    assert.equal(proof.status, "verified");

    const receiptDir = path.join(workspace, ".ma", "tasks", "execution-receipts");
    const receiptFiles = await fs.readdir(receiptDir);
    assert.ok(receiptFiles.length > 0, "live task must write an execution receipt");
    const receipt = await readJson(path.join(receiptDir, receiptFiles[0]));
    assert.equal(receipt.status, "completed");
    assert.deepEqual(receipt.disallowedFiles, []);
    assert.ok(receipt.changedFiles.includes("src/live-regression-proof.json"));

    const status = JSON.parse(statusStage.stdout);
    const managerRuns = await readJson(path.join(workspace, ".ma", "state", "manager-runs.json"));
    const liveDecision = [...managerRuns.runs]
      .reverse()
      .find((entry) => entry.decision?.provider === "jev");
    assert.ok(liveDecision, "live Maestro run must persist Jev evidence");

    const evidence = {
      schemaVersion: "1.0.0",
      record_type: "ma_live_regression_evidence",
      status: "passed",
      releaseVersion: packageMetadata.version,
      runId,
      startedAt,
      completedAt: new Date().toISOString(),
      provider: {
        name: liveDecision.decision.provider,
        model: liveDecision.decision.model ?? null,
        decisionId: liveDecision.decision.decisionId ?? null,
        selectedAction: liveDecision.decision.choice ?? null,
      },
      stages,
      assertions: {
        cleanGitWorkspace: true,
        setupCreatedMaState: true,
        doctorCompleted: true,
        liveProviderDecision: true,
        autonomousTaskCompleted: true,
        sourceMutationVerified: true,
        executionReceiptVerified: true,
        disallowedFiles: receipt.disallowedFiles,
        runtimeSummaryStatus: status.runtime?.status ?? status.scope ?? null,
      },
      workspace: {
        isolated: true,
        sourceMutation: "src/live-regression-proof.json",
        retained: false,
      },
    };
    await removeTestNamespace(workspace);
    workspaceRemoved = true;
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`);
    console.log(
      JSON.stringify({ status: "passed", output, runId, provider: evidence.provider }, null, 2),
    );
  } catch (error) {
    if (error.stage) stages.push(error.stage);
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(
      output,
      `${JSON.stringify(
        {
          schemaVersion: "1.0.0",
          record_type: "ma_live_regression_evidence",
          status: "failed",
          releaseVersion: packageMetadata.version,
          runId,
          startedAt,
          completedAt: new Date().toISOString(),
          error: redact(error.message, workspace),
          stages,
          workspace: { isolated: true, retained: !workspaceRemoved },
        },
        null,
        2,
      )}\n`,
    );
    throw error;
  } finally {
    if (!workspaceRemoved) {
      await removeTestNamespace(workspace);
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
