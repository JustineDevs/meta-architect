#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import {
  getDebArtifactPath,
  getPacmanArtifactPath,
  getRpmArtifactPath,
  LINUX_PACKAGE_NAME,
} from "./linux-package-lib.mjs";

const repoRoot = process.cwd();
const pkg = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf8"));
const version = pkg.version;
const distRoot = path.join(repoRoot, "dist");

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    stdio: "pipe",
    ...options,
  });
}

function runBinary(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: null,
    maxBuffer: 32 * 1024 * 1024,
    stdio: "pipe",
    ...options,
  });
}

async function smokeExtractedRoot(extractRoot, label) {
  const workRoot = path.join(extractRoot, `${label}-project`);
  const codexHome = path.join(extractRoot, `${label}-codex-home`);
  await fs.mkdir(workRoot, { recursive: true });
  await fs.mkdir(codexHome, { recursive: true });
  const maBin = path.join(extractRoot, "usr", "bin", "ma");
  const env = {
    ...process.env,
    CODEX_HOME: codexHome,
    MA_DISABLE_LIVE_MCP: "1",
    META_ARCHITECT_PREFIX: extractRoot,
  };
  const setupResult = run(maBin, ["setup"], { cwd: workRoot, env });
  assert.equal(setupResult.status, 0, setupResult.stderr || setupResult.stdout);
  await fs.access(path.join(workRoot, ".ma", "release.json"));
  await fs.access(path.join(workRoot, ".ma", "decisions.json"));
  await fs.access(path.join(extractRoot, "usr", "bin", "meta-architect"));
  const statusResult = run(maBin, ["status"], { cwd: workRoot, env });
  assert.equal(statusResult.status, 0, statusResult.stderr || statusResult.stdout);
}

async function main() {
  if (process.platform !== "linux") {
    throw new Error("Native Linux package smoke validation is supported only on Linux hosts");
  }

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "meta-architect-linux-smoke-"));
  const debExtractRoot = path.join(tempRoot, "deb");
  const pacmanExtractRoot = path.join(tempRoot, "pacman");
  const rpmExtractRoot = path.join(tempRoot, "rpm");
  await fs.mkdir(debExtractRoot, { recursive: true });
  await fs.mkdir(pacmanExtractRoot, { recursive: true });
  await fs.mkdir(rpmExtractRoot, { recursive: true });

  const debArtifactPath = getDebArtifactPath(distRoot, version);
  const pacmanArtifactPath = getPacmanArtifactPath(distRoot, version);
  const rpmArtifactPath = getRpmArtifactPath(distRoot, version);
  const extractDeb = run("dpkg-deb", ["-x", debArtifactPath, debExtractRoot], { cwd: repoRoot });
  assert.equal(extractDeb.status, 0, extractDeb.stderr || extractDeb.stdout);
  const extractPacman = run("tar", ["-xJf", pacmanArtifactPath, "-C", pacmanExtractRoot], {
    cwd: repoRoot,
  });
  assert.equal(extractPacman.status, 0, extractPacman.stderr || extractPacman.stdout);
  const archiveConversion = runBinary("rpm2archive", [rpmArtifactPath], { cwd: rpmExtractRoot });
  assert.equal(
    archiveConversion.status,
    0,
    archiveConversion.stderr?.toString("utf8") || archiveConversion.stdout?.toString("utf8"),
  );
  const rpmArchivePath = path.join(rpmExtractRoot, `${path.basename(rpmArtifactPath)}.tgz`);
  await fs.writeFile(rpmArchivePath, archiveConversion.stdout);
  const extractRpm = run("tar", ["-xzf", rpmArchivePath, "-C", rpmExtractRoot], { cwd: repoRoot });
  assert.equal(extractRpm.status, 0, extractRpm.stderr || extractRpm.stdout);
  await fs.access(path.join(pacmanExtractRoot, ".PKGINFO"));
  await fs.access(path.join(pacmanExtractRoot, "usr", "lib", LINUX_PACKAGE_NAME, "bin", "ma.js"));
  await fs.access(path.join(rpmExtractRoot, "usr", "lib", LINUX_PACKAGE_NAME, "bin", "ma.js"));

  await smokeExtractedRoot(debExtractRoot, "deb");
  await smokeExtractedRoot(pacmanExtractRoot, "pacman");
  await smokeExtractedRoot(rpmExtractRoot, "rpm");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
