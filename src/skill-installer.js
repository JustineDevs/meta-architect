import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { packageRoot } from "./paths.js";

function resolveCodexHome() {
  return process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex");
}

function resolveSkillInstallRoot() {
  return path.join(resolveCodexHome(), "skills");
}

function resolveSupportBundleRoot() {
  return path.join(resolveCodexHome(), "meta-architect-sdk");
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

export function getSupportBundleRoot() {
  return resolveSupportBundleRoot();
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

async function copyPath(src, dest) {
  const stat = await fs.stat(src);
  if (stat.isDirectory()) {
    await fs.rm(dest, { recursive: true, force: true });
    await copyDir(src, dest);
    return "directory";
  }

  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
  return "file";
}

export async function installSupportBundle({ targetRoot = getSupportBundleRoot() } = {}) {
  const assets = [
    {
      name: "mcp",
      src: path.join(packageRoot, "mcp"),
      dest: path.join(targetRoot, "mcp"),
    },
    {
      name: "sprint",
      src: path.join(packageRoot, "sprint"),
      dest: path.join(targetRoot, "sprint"),
    },
    {
      name: "prompts",
      src: path.join(packageRoot, ".codex", "prompts"),
      dest: path.join(targetRoot, "prompts"),
    },
    {
      name: "scripts",
      src: path.join(packageRoot, "scripts"),
      dest: path.join(targetRoot, "scripts"),
    },
    {
      name: "plugin",
      src: path.join(packageRoot, "plugins", "meta-architect"),
      dest: path.join(targetRoot, "plugins", "meta-architect"),
    },
    {
      name: "templates",
      src: path.join(packageRoot, "templates"),
      dest: path.join(targetRoot, "templates"),
    },
    {
      name: "docs-readme",
      src: path.join(packageRoot, "docs", "README.md"),
      dest: path.join(targetRoot, "docs", "README.md"),
    },
  ];

  await fs.mkdir(targetRoot, { recursive: true });
  const installed = [];
  for (const asset of assets) {
    await copyPath(asset.src, asset.dest);
    installed.push({ name: asset.name, dest: asset.dest });
  }

  const pkg = JSON.parse(await fs.readFile(path.join(packageRoot, "package.json"), "utf8"));
  const manifest = {
    packageName: pkg.name,
    packageVersion: pkg.version,
    installedAt: new Date().toISOString(),
    root: targetRoot,
    assets: installed,
  };
  await fs.writeFile(
    path.join(targetRoot, "asset-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

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

export async function isSupportBundleInstalled({ targetRoot = getSupportBundleRoot() } = {}) {
  const requiredFiles = [
    path.join(targetRoot, "asset-manifest.json"),
    path.join(targetRoot, "mcp", "servers.json"),
    path.join(targetRoot, "sprint", "07-release.md"),
    path.join(targetRoot, "prompts", "onboarding.md"),
    path.join(targetRoot, "scripts", "skills-install.js"),
    path.join(targetRoot, "plugins", "meta-architect", ".codex-plugin", "plugin.json"),
    path.join(targetRoot, "templates", "AGENTS.md"),
  ];

  for (const file of requiredFiles) {
    try {
      await fs.access(file);
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

export async function ensureSupportBundleInstalled({ targetRoot = getSupportBundleRoot() } = {}) {
  if (process.env.MA_SKIP_AUTO_INSTALL === "1") {
    return { targetRoot, installed: [], skipped: true };
  }

  if (await isSupportBundleInstalled({ targetRoot })) {
    return { targetRoot, installed: [], skipped: false };
  }

  const result = await installSupportBundle({ targetRoot });
  return { ...result, skipped: false };
}
