import fs from "node:fs/promises";
import path from "node:path";
import { getRepoRoot } from "../../src/paths.js";

const ignoredDirs = new Set([".git", ".ma", ".omx", "node_modules"]);
const codeIntelTools = [
  "code_intel.list_files",
  "code_intel.search_text",
  "code_intel.read_excerpt",
];

async function walk(rootDir, currentDir = rootDir, files = [], limit = Number.POSITIVE_INFINITY) {
  if (files.length >= limit) {
    return files;
  }

  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (files.length >= limit) {
      break;
    }

    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) {
        continue;
      }
      await walk(rootDir, path.join(currentDir, entry.name), files, limit);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }
    files.push(path.relative(rootDir, path.join(currentDir, entry.name)));
  }

  return files;
}

export function listCodeIntelTools() {
  return [...codeIntelTools];
}

export async function listRepoFiles(limit = 200) {
  const repoRoot = getRepoRoot();
  return walk(repoRoot, repoRoot, [], limit);
}

export async function searchRepoText(query, limit = 20) {
  const repoRoot = getRepoRoot();
  const files = await listRepoFiles(500);
  const matches = [];

  for (const relativePath of files) {
    if (matches.length >= limit) {
      break;
    }

    try {
      const content = await fs.readFile(path.join(repoRoot, relativePath), "utf8");
      const lines = content.split("\n");
      lines.forEach((line, index) => {
        if (matches.length < limit && line.includes(query)) {
          matches.push({ file: relativePath, line: index + 1, text: line.trim() });
        }
      });
    } catch {
      // Skip non-text files.
    }
  }

  return matches;
}

export async function readRepoExcerpt(relativePath, line = 1, context = 2) {
  const repoRoot = getRepoRoot();
  const content = await fs.readFile(path.join(repoRoot, relativePath), "utf8");
  const lines = content.split("\n");
  const start = Math.max(0, line - context - 1);
  const end = Math.min(lines.length, line + context);
  return lines.slice(start, end).map((text, index) => ({
    line: start + index + 1,
    text,
  }));
}

export async function callCodeIntelTool(name, args = {}) {
  if (name === "code_intel.list_files") {
    return listRepoFiles(args.limit);
  }
  if (name === "code_intel.search_text") {
    if (typeof args.query !== "string" || args.query.trim() === "") {
      throw new Error("code_intel.search_text requires a non-empty query");
    }
    return searchRepoText(args.query, args.limit);
  }
  if (name === "code_intel.read_excerpt") {
    if (typeof args.file !== "string" || args.file.trim() === "") {
      throw new Error("code_intel.read_excerpt requires a file path");
    }
    return readRepoExcerpt(args.file, args.line, args.context);
  }

  throw new Error(`Unknown code_intel tool: ${name}`);
}

export async function checkCodeIntelCapability() {
  const files = await listRepoFiles(10);
  return {
    ready: files.length > 0,
    detail: `code intel indexed ${files.length} repo file(s) in the readiness sample`,
  };
}
