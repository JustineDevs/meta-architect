import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getAgent } from "./agents.js";
import { getBundledDocsPath, packageRoot } from "./paths.js";

function resolveCodexHome() {
  return process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex");
}

function resolveSkillInstallRoot(agentType = "codex") {
  const agent = getAgent(agentType);
  if (agentType !== "codex" && agent.globalSkillsDir?.startsWith("~/")) {
    return path.join(os.homedir(), agent.globalSkillsDir.slice(2));
  }
  return path.join(resolveCodexHome(), "skills");
}

function resolveSupportBundleRoot() {
  return path.join(resolveCodexHome(), "meta-architect-sdk");
}

async function copyDir(src, dest, { omitIndex = false } = {}) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (omitIndex && entry.name === "index.json") continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    const sourceStat = entry.isSymbolicLink() ? await fs.stat(srcPath) : entry;
    if (sourceStat.isDirectory()) {
      await copyDir(srcPath, destPath, { omitIndex });
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(root, current = root, output = []) {
  const entries = await fs.readdir(current, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.name === ".ma-install-receipt.json" || entry.name === ".ma-backups") continue;
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) await listFiles(root, absolute, output);
    else if (entry.isFile()) output.push(path.relative(root, absolute));
  }
  return output.sort();
}

async function treeHash(root) {
  const hash = crypto.createHash("sha256");
  for (const relative of await listFiles(root)) {
    hash.update(relative);
    hash.update(await fs.readFile(path.join(root, relative)));
  }
  return hash.digest("hex");
}

export async function readInstallReceipt(root, kind = "skills") {
  try {
    return JSON.parse(await fs.readFile(installReceiptPath(root, kind), "utf8"));
  } catch {
    return null;
  }
}

function installReceiptPath(root, kind = "skills") {
  if (kind === "skills" && path.basename(root) === "skills") {
    return path.join(path.dirname(root), ".ma", "codex-skills-install-receipt.json");
  }
  return path.join(root, ".ma-install-receipt.json");
}

async function writeInstallReceipt(root, receipt, kind = "skills") {
  const receiptPath = installReceiptPath(root, kind);
  await fs.mkdir(path.dirname(receiptPath), { recursive: true });
  await fs.writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
}

async function backupPath(root, source, label) {
  const backupRoot = path.join(root, ".ma-backups", `${Date.now()}-${label}`);
  await copyPath(source, backupRoot);
  return backupRoot;
}

export function getSkillInstallRoot(agentType = "codex") {
  return resolveSkillInstallRoot(agentType);
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
  const previous = await readInstallReceipt(targetRoot, "skills");
  const managed = new Set(previous?.managedPaths ?? []);

  const installed = [];
  const conflicts = [];
  const backups = [];
  for (const skill of skills) {
    const src = path.join(packageRoot, skill.path);
    const dest = path.join(targetRoot, path.basename(skill.path));
    if (await pathExists(dest)) {
      if (!managed.has(path.basename(skill.path))) {
        conflicts.push({ name: skill.name, dest, reason: "existing-unmanaged-path" });
        continue;
      }
      backups.push({
        name: skill.name,
        path: await backupPath(targetRoot, dest, path.basename(skill.path)),
      });
      await fs.rm(dest, { recursive: true, force: true });
    }
    await copyDir(src, dest, {
      omitIndex: dest.endsWith(path.join("plugins", "meta-architect", "skills")),
    });
    installed.push({ name: skill.name, dest, hash: await treeHash(dest) });
  }

  await writeInstallReceipt(
    targetRoot,
    {
      schemaVersion: "1.0.0",
      record_type: "codex_skill_install_receipt",
      packageName: "@jstn-sdk/ma",
      packageVersion: JSON.parse(await fs.readFile(path.join(packageRoot, "package.json"), "utf8"))
        .version,
      installedAt: new Date().toISOString(),
      managedPaths: installed.map((entry) => path.basename(entry.dest)),
      installed,
      conflicts,
      backups,
    },
    "skills",
  );

  return { targetRoot, installed, conflicts, backups };
}

async function copyPath(src, dest) {
  const stat = await fs.stat(src);
  if (stat.isDirectory()) {
    await fs.rm(dest, { recursive: true, force: true });
    await copyDir(src, dest, {
      omitIndex: dest.endsWith(path.join("plugins", "meta-architect", "skills")),
    });
    return "directory";
  }

  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
  return "file";
}

export async function loadSupportBundleManifest() {
  const manifest = JSON.parse(
    await fs.readFile(path.join(packageRoot, "support-bundle.json"), "utf8"),
  );
  if (
    manifest.schemaVersion !== "1.0.0" ||
    !/^\d+\.\d+\.\d+$/.test(manifest.bundleVersion) ||
    manifest.compatibility?.managedBy !== "@jstn-sdk/ma" ||
    typeof manifest.compatibility?.node !== "string"
  ) {
    throw new Error("Invalid support bundle manifest version");
  }
  if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) {
    throw new Error("Support bundle manifest must define assets");
  }
  for (const asset of manifest.assets) {
    if (
      typeof asset.name !== "string" ||
      typeof asset.source !== "string" ||
      typeof asset.destination !== "string" ||
      !["file", "directory"].includes(asset.type) ||
      typeof asset.required !== "boolean"
    ) {
      throw new Error(`Invalid support bundle asset: ${asset.name ?? "(unnamed)"}`);
    }
  }
  return manifest;
}

export async function installSupportBundle({ targetRoot = getSupportBundleRoot() } = {}) {
  const pkg = JSON.parse(await fs.readFile(path.join(packageRoot, "package.json"), "utf8"));
  const bundle = await loadSupportBundleManifest();
  if (bundle.bundleVersion !== pkg.version) {
    throw new Error(
      `Support bundle manifest ${bundle.bundleVersion} does not match package ${pkg.version}`,
    );
  }

  await fs.mkdir(targetRoot, { recursive: true });
  const previous = await readInstallReceipt(targetRoot, "support");
  const managed = new Set(previous?.managedPaths ?? []);
  const installed = [];
  const conflicts = [];
  const backups = [];
  for (const asset of bundle.assets) {
    const source =
      asset.source === "docs/README.md"
        ? getBundledDocsPath("README.md")
        : asset.source === "docs/reference"
          ? getBundledDocsPath("reference")
          : path.join(packageRoot, asset.source);
    if (!(await pathExists(source))) {
      if (asset.required) throw new Error(`Missing required support bundle asset: ${asset.source}`);
      continue;
    }
    const destination = path.join(targetRoot, asset.destination);
    if (await pathExists(destination)) {
      if (!managed.has(asset.destination)) {
        conflicts.push({ name: asset.name, dest: destination, reason: "existing-unmanaged-path" });
        continue;
      }
      backups.push({
        name: asset.name,
        path: await backupPath(targetRoot, destination, asset.name),
      });
    }
    await copyPath(source, destination);
    installed.push({
      name: asset.name,
      class: asset.class,
      dest: destination,
      relative: asset.destination,
    });
  }

  const manifest = {
    schemaVersion: bundle.schemaVersion,
    bundleVersion: bundle.bundleVersion,
    packageName: pkg.name,
    packageVersion: pkg.version,
    installedAt: new Date().toISOString(),
    root: targetRoot,
    assets: installed,
    conflicts,
    backups,
  };
  await fs.writeFile(
    path.join(targetRoot, "asset-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  await writeInstallReceipt(
    targetRoot,
    {
      ...manifest,
      record_type: "codex_support_bundle_install_receipt",
      managedPaths: installed.map((asset) => asset.relative),
      conflicts,
      backups,
    },
    "support",
  );

  return { targetRoot, installed, conflicts, backups };
}

export async function rollbackInstalledAssets({ targetRoot, kind = "skills" } = {}) {
  const root = targetRoot ?? (kind === "skills" ? getSkillInstallRoot() : getSupportBundleRoot());
  const receipt = await readInstallReceipt(root, kind);
  if (!receipt) return { status: "nothing-to-rollback", removed: [], restored: [], skipped: [] };
  const restored = [];
  const removed = [];
  const skipped = [];
  for (const entry of receipt.installed ?? []) {
    const relative = entry.relative ?? path.basename(entry.dest);
    const dest = path.isAbsolute(entry.dest) ? entry.dest : path.join(root, relative);
    if (!(await pathExists(dest))) continue;
    if (entry.hash && (await treeHash(dest)) !== entry.hash) {
      skipped.push({ path: dest, reason: "modified-after-install" });
      continue;
    }
    await fs.rm(dest, { recursive: true, force: true });
    removed.push(dest);
  }
  for (const backup of receipt.backups ?? []) {
    if (!(await pathExists(backup.path))) continue;
    const relative =
      receipt.installed?.find((entry) => entry.name === backup.name)?.relative ?? backup.name;
    const dest = path.join(root, relative);
    await fs.rm(dest, { recursive: true, force: true });
    await copyPath(backup.path, dest);
    restored.push(dest);
  }
  if (kind === "support") {
    await fs.rm(path.join(root, "asset-manifest.json"), { force: true });
  }
  if (skipped.length === 0) await fs.rm(installReceiptPath(root, kind), { force: true });
  return { status: skipped.length ? "partial" : "rolled-back", removed, restored, skipped };
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
  const pkg = JSON.parse(await fs.readFile(path.join(packageRoot, "package.json"), "utf8"));
  const bundle = await loadSupportBundleManifest();
  const requiredFiles = [
    path.join(targetRoot, "asset-manifest.json"),
    path.join(targetRoot, "mcp", "servers.json"),
    path.join(targetRoot, "mcp", "native-playbooks.json"),
    path.join(targetRoot, "mcp", "local", "playbooks.js"),
    path.join(targetRoot, "sprint", "07-release.md"),
    path.join(targetRoot, "prompts", "onboarding.md"),
    path.join(targetRoot, "scripts", "skills-install.js"),
    path.join(targetRoot, "plugins", "meta-architect", ".codex-plugin", "plugin.json"),
    path.join(targetRoot, "templates", "AGENTS.md"),
  ];

  const requiredReferenceFiles = [
    path.join(targetRoot, "docs", "reference", "native-engineering-patterns.md"),
    path.join(targetRoot, "docs", "reference", "native-style-and-deslop.md"),
    path.join(targetRoot, "docs", "reference", "native-security-playbooks.md"),
    path.join(targetRoot, "docs", "reference", "native-source-selection.md"),
  ];

  if (await pathExists(getBundledDocsPath("reference"))) {
    requiredFiles.push(path.join(targetRoot, "docs", "reference"));
    requiredFiles.push(...requiredReferenceFiles);
  }

  for (const file of requiredFiles) {
    if (!(await pathExists(file))) {
      return false;
    }
  }

  const manifestPath = path.join(targetRoot, "asset-manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  if (manifest.schemaVersion !== "1.0.0" || manifest.bundleVersion !== pkg.version) {
    return false;
  }
  const assetNames = new Set((manifest.assets ?? []).map((asset) => asset.name));

  for (const requiredAsset of bundle.assets.filter((asset) => asset.required)) {
    if (!assetNames.has(requiredAsset.name)) {
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
