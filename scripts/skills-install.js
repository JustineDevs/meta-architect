#!/usr/bin/env node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const skillsRoot = path.join(repoRoot, "skills");

function parseArgs(argv) {
  const args = { path: null };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--path") {
      args.path = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

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
  const args = parseArgs(process.argv.slice(2));
  const targetRoot =
    args.path ?? path.join(process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex"), "skills");

  await fs.mkdir(targetRoot, { recursive: true });
  const skillEntries = await fs.readdir(skillsRoot, { withFileTypes: true });

  for (const entry of skillEntries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const src = path.join(skillsRoot, entry.name);
    const dest = path.join(targetRoot, entry.name);
    await fs.rm(dest, { recursive: true, force: true });
    await copyDir(src, dest);
    console.log(`installed ${entry.name} -> ${dest}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
