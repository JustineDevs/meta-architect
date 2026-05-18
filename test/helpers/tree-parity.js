import fs from "node:fs/promises";
import path from "node:path";

export async function listRelativeFiles(root) {
  const files = [];

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      files.push(path.relative(root, entryPath).replaceAll(path.sep, "/"));
    }
  }

  await walk(root);
  files.sort();
  return files;
}
