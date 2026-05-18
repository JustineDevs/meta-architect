import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const ignoredEntries = new Set([
  ".git",
  "node_modules",
  ".ma",
  ".omx",
  ".claude",
  ".agents",
  ".husky",
]);

export async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (ignoredEntries.has(entry.name)) {
      continue;
    }

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

export async function createTempRepo(prefix, repoRoot) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  await copyDir(repoRoot, tempRoot);
  return tempRoot;
}
