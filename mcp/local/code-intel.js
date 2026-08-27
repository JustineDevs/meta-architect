import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { getRepoRoot } from "../../src/paths.js";

const execFileAsync = promisify(execFile);
const MAX_SCAN_BYTES = 1024 * 1024;
const ignoredDirs = new Set([
  ".git",
  ".ma",
  ".omx",
  ".next",
  ".turbo",
  ".vercel",
  "build",
  "coverage",
  "dist",
  "node_modules",
]);
const artifactExtensions = new Set([
  ".7z",
  ".bin",
  ".bmp",
  ".class",
  ".dll",
  ".dylib",
  ".gif",
  ".gz",
  ".ico",
  ".jar",
  ".jpeg",
  ".jpg",
  ".lockb",
  ".mp3",
  ".mp4",
  ".o",
  ".pdf",
  ".png",
  ".so",
  ".svg",
  ".tar",
  ".tgz",
  ".wasm",
  ".webp",
  ".woff",
  ".woff2",
  ".zip",
  ".zst",
]);
const ignoredFiles = new Set([".active"]);
const codeIntelTools = [
  "code_intel.list_files",
  "code_intel.search_text",
  "code_intel.read_excerpt",
];

function normalizeRelative(relativePath) {
  const normalized = path.posix.normalize(relativePath.replaceAll(path.sep, "/"));
  if (
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("\0")
  ) {
    throw new Error("code_intel path must stay inside the repository");
  }
  return normalized;
}

function isArtifactPath(relativePath) {
  const segments = relativePath.split("/");
  return (
    ignoredFiles.has(segments.at(-1)) ||
    segments.some((segment) => ignoredDirs.has(segment)) ||
    artifactExtensions.has(path.extname(relativePath).toLowerCase())
  );
}

async function isReadableTextFile(absolutePath) {
  const stat = await fs.lstat(absolutePath);
  if (stat.isSymbolicLink()) return false;
  if (!stat.isFile() || stat.size > MAX_SCAN_BYTES) return false;
  const sample = await fs.readFile(absolutePath, { encoding: null, flag: "r" });
  return !sample.subarray(0, Math.min(sample.length, 8192)).includes(0);
}

async function assertSafeRepoPath(rootDir, relativePath) {
  let current = rootDir;
  for (const component of relativePath.split("/")) {
    current = path.join(current, component);
    const stat = await fs.lstat(current).catch((error) => {
      if (error?.code === "ENOENT") return null;
      throw error;
    });
    if (stat?.isSymbolicLink()) throw new Error("code_intel cannot follow symlinks");
  }
  return path.join(rootDir, relativePath);
}

async function listGitFiles(rootDir) {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { cwd: rootDir, encoding: "buffer", maxBuffer: 4 * 1024 * 1024 },
    );
    return stdout
      .toString("utf8")
      .split("\0")
      .filter(Boolean)
      .map((file) => file.replaceAll("\\", "/"));
  } catch {
    return null;
  }
}

async function loadFallbackIgnorePatterns(rootDir) {
  const content = await fs.readFile(path.join(rootDir, ".gitignore"), "utf8").catch(() => "");
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("!"));
}

function isFallbackIgnored(relativePath, patterns) {
  const normalized = relativePath.split(path.sep).join("/");
  return patterns.some((pattern) => {
    const directoryPattern = pattern.endsWith("/") ? pattern.slice(0, -1) : pattern;
    const escaped = directoryPattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    const expression = escaped
      .replaceAll("**", ".*")
      .replaceAll("*", "[^/]*")
      .replaceAll("?", "[^/]");
    const matcher = new RegExp(`(?:^|/)${expression}(?:/|$)`);
    return (
      matcher.test(normalized) ||
      (!pattern.includes("/") && new RegExp(`(^|/)${expression}$`).test(normalized))
    );
  });
}

async function walkFallback(rootDir, currentDir = rootDir, files = [], limit = 200, patterns = []) {
  if (files.length >= limit) return files;
  const entries = await fs.readdir(currentDir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (files.length >= limit) break;
    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = path.relative(rootDir, absolutePath);
    if (isFallbackIgnored(relativePath, patterns)) continue;
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        await walkFallback(rootDir, absolutePath, files, limit, patterns);
      }
    } else if (entry.isFile() && !isArtifactPath(relativePath)) {
      files.push(relativePath.split(path.sep).join("/"));
    }
  }
  return files;
}

async function listSafeFiles(rootDir, limit = 200) {
  const gitFiles = await listGitFiles(rootDir);
  const candidates =
    gitFiles ??
    (await walkFallback(rootDir, rootDir, [], limit, await loadFallbackIgnorePatterns(rootDir)));
  const files = [];
  for (const relativePath of candidates) {
    if (files.length >= limit) break;
    const normalized = normalizeRelative(relativePath);
    if (isArtifactPath(normalized)) continue;
    try {
      const absolute = await assertSafeRepoPath(rootDir, normalized);
      if (await isReadableTextFile(absolute)) files.push(normalized);
    } catch {
      // Ignore files that disappear or cannot be inspected.
    }
  }
  return files;
}

export function listCodeIntelTools() {
  return [...codeIntelTools];
}

export async function listRepoFiles(limit = 200) {
  return listSafeFiles(getRepoRoot(), Math.max(1, Math.min(Number(limit) || 200, 2000)));
}

export async function searchRepoText(query, limit = 20) {
  const repoRoot = getRepoRoot();
  const files = await listRepoFiles(500);
  const matches = [];
  const boundedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  for (const relativePath of files) {
    if (matches.length >= boundedLimit) break;
    try {
      const content = await fs.readFile(path.join(repoRoot, relativePath), "utf8");
      content.split("\n").forEach((line, index) => {
        if (matches.length < boundedLimit && line.includes(query)) {
          matches.push({ file: relativePath, line: index + 1, text: line.trim() });
        }
      });
    } catch {
      // Skip files that disappear or fail the text boundary.
    }
  }
  return matches;
}

export async function readRepoExcerpt(relativePath, line = 1, context = 2) {
  const repoRoot = getRepoRoot();
  const normalized = normalizeRelative(relativePath);
  if (isArtifactPath(normalized))
    throw new Error("code_intel cannot read generated or binary artifacts");
  const absolutePath = await assertSafeRepoPath(repoRoot, normalized);
  if (!(await isReadableTextFile(absolutePath)))
    throw new Error("code_intel can only read bounded text files");
  const content = await fs.readFile(absolutePath, "utf8");
  const safeLine = Math.max(1, Number(line) || 1);
  const safeContext = Math.max(0, Math.min(Number(context) || 2, 20));
  const lines = content.split("\n");
  const start = Math.max(0, safeLine - safeContext - 1);
  const end = Math.min(lines.length, safeLine + safeContext);
  return lines.slice(start, end).map((text, index) => ({ line: start + index + 1, text }));
}

export async function callCodeIntelTool(name, args = {}) {
  if (name === "code_intel.list_files") return listRepoFiles(args.limit);
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
    detail: `code intel indexed ${files.length} bounded text file(s) with Git-ignore and artifact filtering`,
  };
}
