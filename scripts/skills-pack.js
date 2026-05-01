#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const distRoot = path.join(repoRoot, "dist");
const bundlePath = path.join(distRoot, "meta-architect-skills.tgz");
const skillsRoot = path.join(repoRoot, "skills");

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function main() {
  await fs.mkdir(distRoot, { recursive: true });
  await fs.rm(bundlePath, { force: true });
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "meta-architect-skills-"));
  const frozenSkillsRoot = path.join(tempRoot, "skills");
  await copyDir(skillsRoot, frozenSkillsRoot);

  const result = spawnSync("tar", ["-czf", bundlePath, "skills"], {
    cwd: tempRoot,
    encoding: "utf8",
  });

  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  await fs.rm(tempRoot, { recursive: true, force: true });

  console.log(bundlePath);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
