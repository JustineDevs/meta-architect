#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const skillsRoot = path.join(repoRoot, "skills");
const pluginRoot = path.join(repoRoot, "plugins", "meta-architect");
const pluginSkillsRoot = path.join(pluginRoot, "skills");

function parseArgs(argv) {
  return {
    check: argv.includes("--check"),
  };
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

async function listSkillDirs(root) {
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function syncPluginSkills() {
  const skillDirs = await listSkillDirs(skillsRoot);
  await fs.mkdir(pluginSkillsRoot, { recursive: true });

  const existingPluginDirs = await listSkillDirs(pluginSkillsRoot);
  for (const name of existingPluginDirs) {
    if (!skillDirs.includes(name)) {
      await fs.rm(path.join(pluginSkillsRoot, name), { recursive: true, force: true });
    }
  }

  for (const name of skillDirs) {
    const src = path.join(skillsRoot, name);
    const dest = path.join(pluginSkillsRoot, name);
    await fs.rm(dest, { recursive: true, force: true });
    await copyDir(src, dest);
  }

  return skillDirs;
}

async function verifyPluginSkills() {
  const skillDirs = await listSkillDirs(skillsRoot);
  const pluginDirs = await listSkillDirs(pluginSkillsRoot);
  if (skillDirs.length !== pluginDirs.length) {
    throw new Error("Plugin skill mirror drift: directory count mismatch");
  }

  for (let index = 0; index < skillDirs.length; index += 1) {
    if (skillDirs[index] !== pluginDirs[index]) {
      throw new Error(
        `Plugin skill mirror drift: expected ${skillDirs[index]}, found ${pluginDirs[index]}`,
      );
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.check) {
    await verifyPluginSkills();
    console.log(pluginSkillsRoot);
    return;
  }

  await syncPluginSkills();
  console.log(pluginSkillsRoot);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
