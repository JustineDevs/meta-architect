import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { packageRoot } from "./paths.js";

function resolveSkillInstallRoot() {
  const codexHome = process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex");
  return path.join(codexHome, "skills");
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

export function getSkillInstallRoot() {
  return resolveSkillInstallRoot();
}

export async function loadSkillManifest() {
  const manifestPath = path.join(packageRoot, "skills", "index.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  return manifest.skills ?? [];
}

export async function installSkills({ targetRoot = getSkillInstallRoot() } = {}) {
  const skills = await loadSkillManifest();
  await fs.mkdir(targetRoot, { recursive: true });

  const installed = [];
  for (const skill of skills) {
    const src = path.join(packageRoot, skill.path);
    const dest = path.join(targetRoot, path.basename(skill.path));
    await fs.rm(dest, { recursive: true, force: true });
    await copyDir(src, dest);
    installed.push({ name: skill.name, dest });
  }

  return { targetRoot, installed };
}

export async function areSkillsInstalled({ targetRoot = getSkillInstallRoot() } = {}) {
  const skills = await loadSkillManifest();

  for (const skill of skills) {
    const skillDir = path.join(targetRoot, path.basename(skill.path));
    try {
      await fs.access(path.join(skillDir, "SKILL.md"));
    } catch {
      return false;
    }
  }

  return true;
}

export async function ensureSkillsInstalled({ targetRoot = getSkillInstallRoot() } = {}) {
  if (process.env.MA_SKIP_AUTO_INSTALL === "1") {
    return { targetRoot, installed: [], skipped: true };
  }

  if (await areSkillsInstalled({ targetRoot })) {
    return { targetRoot, installed: [], skipped: false };
  }

  const result = await installSkills({ targetRoot });
  return { ...result, skipped: false };
}
