#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

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
      await fs.chmod(destPath, 0o644);
    }
  }
}

async function linkOrCopyDir(src, dest) {
  if (process.env.MA_PLUGIN_SYNC_MODE !== "copy") {
    try {
      await fs.symlink(path.relative(path.dirname(dest), src), dest, "dir");
      return "symlink";
    } catch {
      // Restricted worktrees and Windows may reject directory links.
    }
  }
  await copyDir(src, dest);
  return "copy";
}

async function listSkillDirs(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
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
    await linkOrCopyDir(src, dest);
  }

  return skillDirs;
}

async function listFiles(root, current = root, files = []) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(current, entry.name);
    if (entry.isDirectory() || entry.isSymbolicLink()) {
      await listFiles(root, absolutePath, files);
    } else if (entry.isFile()) {
      files.push(path.relative(root, absolutePath));
    }
  }
  return files.sort();
}

export async function verifyPluginSkills(sourceRoot = skillsRoot, mirrorRoot = pluginSkillsRoot) {
  await fs.access(sourceRoot);
  await fs.access(mirrorRoot);
  const sourceSkillDirs = await listSkillDirs(sourceRoot);
  const mirrorSkillDirs = await listSkillDirs(mirrorRoot);
  const filesForSkillDirs = async (root, skillDirs) => {
    const files = [];
    for (const skillDir of skillDirs) {
      for (const relativePath of await listFiles(path.join(root, skillDir))) {
        files.push(path.join(skillDir, relativePath));
      }
    }
    return files.sort();
  };
  const sourceFiles = await filesForSkillDirs(sourceRoot, sourceSkillDirs);
  const mirrorFiles = await filesForSkillDirs(mirrorRoot, mirrorSkillDirs);
  if (JSON.stringify(sourceFiles) !== JSON.stringify(mirrorFiles)) {
    throw new Error("Plugin skill mirror drift: file set mismatch");
  }

  for (const relativePath of sourceFiles) {
    const sourcePath = path.join(sourceRoot, relativePath);
    const mirrorPath = path.join(mirrorRoot, relativePath);
    const [source, mirror, sourceStat, mirrorStat] = await Promise.all([
      fs.readFile(sourcePath),
      fs.readFile(mirrorPath),
      fs.stat(sourcePath),
      fs.stat(mirrorPath),
    ]);
    if (!source.equals(mirror)) {
      throw new Error(`Plugin skill mirror drift: content mismatch at ${relativePath}`);
    }
    if ((sourceStat.mode & 0o777) !== (mirrorStat.mode & 0o777)) {
      throw new Error(`Plugin skill mirror drift: mode mismatch at ${relativePath}`);
    }
  }
  for (const skillDir of sourceSkillDirs) {
    const mirrorPath = path.join(mirrorRoot, skillDir);
    const mirrorStat = await fs.lstat(mirrorPath);
    if (mirrorStat.isSymbolicLink()) {
      const [sourceRealPath, mirrorRealPath] = await Promise.all([
        fs.realpath(path.join(sourceRoot, skillDir)),
        fs.realpath(mirrorPath),
      ]);
      if (sourceRealPath !== mirrorRealPath) {
        throw new Error(`Plugin skill mirror drift: invalid symlink target at ${skillDir}`);
      }
    } else if (!mirrorStat.isDirectory()) {
      throw new Error(`Plugin skill mirror drift: invalid mirror entry at ${skillDir}`);
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
