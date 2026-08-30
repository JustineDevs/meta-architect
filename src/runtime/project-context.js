import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { readJson, writeJson } from "../fs-utils.js";
import { getRepoRoot } from "../paths.js";
import { safeExecFile } from "../process-utils.js";
import { createFreshness } from "./context-authority.js";
import { createManagedMarkdownBlock, replaceManagedMarkdownBlock } from "./managed-markdown.js";

const execFileAsync = promisify(safeExecFile);
export const projectIndexSchemaVersion = "0.1.0";
const MAX_SOURCE_FILES = 2000;
const GENERATED_DIRS = [
  "node_modules",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".vercel",
  ".git",
  ".ma",
  ".codex",
  ".omx",
  "coverage",
];
const VISIBLE_HIDDEN_DIRS = new Set([
  ".agents",
  ".claude",
  ".cline",
  ".cursor",
  ".gemini",
  ".github",
  ".openclaw",
  ".pi",
  ".roo",
  ".windsurf",
]);
const SECRET_NAMES = /(^|[._-])(env|secret|token|credential|password|private|key)([._-]|$)/i;
const LANGUAGE_BY_EXTENSION = {
  ".cjs": "javascript",
  ".css": "css",
  ".go": "go",
  ".java": "java",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".py": "python",
  ".rb": "ruby",
  ".rs": "rust",
  ".sql": "sql",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".vue": "vue",
};

export function getProjectIndexPath(root = getRepoRoot()) {
  return path.join(root, ".ma", "context", "project-index.json");
}

export async function refreshProjectIndex(root = getRepoRoot(), { mode = "incremental" } = {}) {
  const previous = await readJson(getProjectIndexPath(root)).catch(() => null);
  const { files: sourceFiles, incompleteScan } = await collectSourceFiles(root);
  const sourceHash = hashSourceFiles(sourceFiles);
  const changedFiles = diffSourceFiles(previous?.sourceFiles, sourceFiles);
  const packageData = await readPackageJson(root);
  const index = {
    schemaVersion: projectIndexSchemaVersion,
    record_type: "project_index",
    authority: "source_truth",
    source: "repository-filesystem",
    freshness: createFreshness({
      status: previous?.freshness?.sourceHash === sourceHash ? "unchanged" : "fresh",
      sourceHash,
      sourceFiles: changedFiles,
    }),
    quality: createContextQuality({ sourceFiles, incompleteScan }),
    project: {
      name: packageData?.name ?? path.basename(path.resolve(root)),
      description: packageData?.description ?? null,
      stack: detectStack(packageData),
    },
    languages: detectLanguages(sourceFiles),
    frameworks: detectFrameworks(packageData),
    packageManager: detectPackageManager(sourceFiles),
    commands: sanitizeCommands(packageData?.scripts ?? {}),
    entrypoints: detectEntrypoints(sourceFiles),
    importantDocs: detectImportantDocs(sourceFiles),
    gitRemote: sanitizeRemote(await readGitValue(root, ["config", "--get", "remote.origin.url"])),
    defaultBranch: await readGitValue(root, [
      "symbolic-ref",
      "--short",
      "refs/remotes/origin/HEAD",
    ]),
    generatedDirectories: GENERATED_DIRS,
    vendorIntegrations: detectVendorIntegrations(sourceFiles),
    workspaces: await detectWorkspaces(root, packageData, sourceFiles),
    nestedRepositories: await detectNestedRepositories(root),
    facts: [],
    knownGaps: Array.isArray(previous?.humanOverrides?.knownGaps)
      ? previous.humanOverrides.knownGaps
      : [],
    sourceFiles,
    humanOverrides: previous?.humanOverrides ?? {},
  };
  const conflicts = findHumanOverrideConflicts(index);
  if (conflicts.length > 0) {
    index.quality = {
      ...index.quality,
      confidence: "conflicting",
      gaps: [
        ...index.quality.gaps,
        ...conflicts.map((entry) => `human correction conflicts with source: ${entry}`),
      ],
      conflicts,
    };
  }
  index.context = {
    authority: "source_truth",
    source: "repository-filesystem",
    freshness: index.freshness,
    provenance: sourceFiles.map((file) => file.path),
  };
  index.facts = createCanonicalFacts(index);
  const affectedArtifacts = getAffectedContextArtifacts(changedFiles);
  await writeJson(getProjectIndexPath(root), index);
  if (mode === "full" || !previous || changedFiles.length > 0) {
    await writeAgentContextArtifacts(root, index);
  }
  await writeJson(path.join(root, ".ma", "context", "refresh-receipt.json"), {
    schemaVersion: projectIndexSchemaVersion,
    record_type: "project_context_refresh",
    mode,
    changedFiles,
    affectedArtifacts,
    staleDerivedArtifacts: changedFiles.length > 0 ? affectedArtifacts : [],
    conflicts,
    refreshedAt: index.freshness.checkedAt,
  });
  return index;
}

function getAffectedContextArtifacts(changedFiles) {
  if (changedFiles.length === 0) return [];
  const artifacts = new Set(["project-index.json", "agent-brief.md", "architecture.md"]);
  if (changedFiles.some((file) => file === "package.json" || file.endsWith("/package.json"))) {
    artifacts.add("commands.json");
  }
  return [...artifacts];
}

async function writeAgentContextArtifacts(root, index) {
  const contextDir = path.join(root, ".ma", "context");
  await fs.mkdir(contextDir, { recursive: true });
  await writeJson(path.join(contextDir, "commands.json"), {
    schemaVersion: projectIndexSchemaVersion,
    record_type: "project_commands",
    authority: "source_truth",
    source: "package.json",
    freshness: index.freshness,
    commands: index.commands,
  });
  const brief = [
    `# ${index.project.name}`,
    "",
    `Authority: ${index.authority} | Freshness: ${index.freshness.status}`,
    `Stack: ${index.project.stack.join(", ") || "unknown"}`,
    `Languages: ${index.languages.join(", ") || "unknown"}`,
    `Commands: ${Object.keys(index.commands).join(", ") || "none detected"}`,
    "First-read: .ma/context/project-index.json",
    "",
    "## Instructions",
    "",
    "Read the source files and configured commands before trusting generated context.",
    "",
  ].join("\n");
  await writeManagedMarkdown(
    path.join(contextDir, "agent-brief.md"),
    createManagedMarkdownBlock({
      id: "agent-brief",
      source: ".ma/context/project-index.json",
      body: brief,
    }),
    "agent-brief",
  );
  const architecture = [
    `# ${index.project.name} Architecture Map`,
    "",
    `Entrypoints: ${index.entrypoints.join(", ") || "none detected"}`,
    `Important docs: ${index.importantDocs.join(", ") || "none detected"}`,
    `Workspaces: ${index.workspaces.packages.length}`,
    "",
  ].join("\n");
  await writeManagedMarkdown(
    path.join(contextDir, "architecture.md"),
    createManagedMarkdownBlock({
      id: "architecture",
      source: ".ma/context/project-index.json",
      body: architecture,
    }),
    "architecture",
  );
}

async function writeManagedMarkdown(filePath, generated, id) {
  const existing = await fs.readFile(filePath, "utf8").catch(() => null);
  if (!existing) {
    await fs.writeFile(filePath, generated, "utf8");
    return;
  }
  await fs.writeFile(filePath, replaceManagedMarkdownBlock(existing, generated, id), "utf8");
}

export async function loadProjectIndex(root = getRepoRoot()) {
  const index = await readJson(getProjectIndexPath(root));
  const qualityNeedsMigration =
    !index.quality ||
    !Array.isArray(index.quality.verification) ||
    !Array.isArray(index.quality.gaps);
  const quality = index.quality
    ? {
        ...index.quality,
        verification: Array.isArray(index.quality.verification)
          ? index.quality.verification
          : ["repository filesystem scan"],
        gaps: Array.isArray(index.quality.gaps) ? index.quality.gaps : [],
      }
    : createContextQuality({ sourceFiles: index.sourceFiles ?? [] });
  if (!Array.isArray(index.facts) || qualityNeedsMigration) {
    const migrated = {
      ...index,
      quality,
      facts: Array.isArray(index.facts) ? index.facts : createCanonicalFacts(index),
    };
    await writeJson(getProjectIndexPath(root), migrated);
    return validateProjectIndex(migrated);
  }
  return validateProjectIndex(index);
}

export function validateProjectIndex(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("project index must be an object");
  }
  if (value.schemaVersion !== projectIndexSchemaVersion) {
    throw new Error(`Unsupported project index schemaVersion: ${value.schemaVersion}`);
  }
  if (value.record_type !== "project_index" || value.authority !== "source_truth") {
    throw new Error("project index has invalid authority metadata");
  }
  if (!value.freshness?.sourceHash || !Array.isArray(value.sourceFiles)) {
    throw new Error("project index requires source freshness metadata");
  }
  if (!value.quality?.completeness || !value.quality?.confidence || !value.quality?.coverage) {
    throw new Error("project index requires quality metadata");
  }
  if (!["complete", "partial", "minimal", "unknown"].includes(value.quality.completeness)) {
    throw new Error("project index has invalid completeness metadata");
  }
  if (!["verified", "inferred", "stale", "conflicting"].includes(value.quality.confidence)) {
    throw new Error("project index has invalid confidence metadata");
  }
  if (!Array.isArray(value.quality.verification) || !Array.isArray(value.quality.gaps)) {
    throw new Error("project index quality requires verification and gaps");
  }
  if (
    !Array.isArray(value.facts) ||
    value.facts.some((fact) => !fact.id || fact.authority !== "source_truth")
  ) {
    throw new Error("project index requires canonical source-truth facts");
  }
  return value;
}

export function createContextQuality({ sourceFiles = [], incompleteScan = false, freshness } = {}) {
  const gaps = [
    ...(sourceFiles.length >= MAX_SOURCE_FILES
      ? [`source scan capped at ${MAX_SOURCE_FILES} files`]
      : []),
    ...(incompleteScan ? ["one or more source directories could not be read"] : []),
  ];
  return {
    completeness: sourceFiles.length === 0 ? "minimal" : gaps.length > 0 ? "partial" : "complete",
    confidence: freshness?.stale ? "stale" : incompleteScan ? "inferred" : "verified",
    coverage: {
      sourceFiles: sourceFiles.length,
      capped: sourceFiles.length >= MAX_SOURCE_FILES,
      scan: incompleteScan ? "incomplete" : "complete",
    },
    verification: ["repository filesystem scan"],
    gaps,
  };
}

export function deduplicateCanonicalFacts(facts = []) {
  const seen = new Set();
  return facts.filter((fact) => {
    const key = fact?.id ?? JSON.stringify([fact?.kind, fact?.key, fact?.value]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findHumanOverrideConflicts(index) {
  const corrections = index.humanOverrides?.corrections;
  if (!corrections || typeof corrections !== "object") return [];
  const conflicts = [];
  for (const [section, values] of Object.entries(corrections)) {
    if (!values || typeof values !== "object") continue;
    for (const [key, value] of Object.entries(values)) {
      const source = index[section]?.[key] ?? index[section === "project" ? "project" : section];
      if (typeof value === "string" && source && source[key] !== value)
        conflicts.push(`${section}.${key}`);
    }
  }
  return conflicts;
}

async function collectSourceFiles(root) {
  const files = [];
  let incompleteScan = false;
  async function walk(current, relativeDirectory = "") {
    if (files.length >= MAX_SOURCE_FILES) return;
    const entries = await fs.readdir(current, { withFileTypes: true }).catch((error) => {
      if (error?.code === "ENOENT") return [];
      incompleteScan = true;
      return [];
    });
    for (const entry of entries) {
      if (files.length >= MAX_SOURCE_FILES) break;
      if (entry.name.startsWith(".") && !VISIBLE_HIDDEN_DIRS.has(entry.name)) continue;
      if (SECRET_NAMES.test(entry.name)) continue;
      const relative = path.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) {
        if (!GENERATED_DIRS.includes(entry.name))
          await walk(path.join(current, entry.name), relative);
        continue;
      }
      if (!entry.isFile()) continue;
      const stat = await fs.stat(path.join(current, entry.name)).catch((error) => {
        if (error?.code === "ENOENT") return null;
        incompleteScan = true;
        return null;
      });
      if (!stat) continue;
      files.push({
        path: relative.split(path.sep).join("/"),
        size: stat.size,
        mtimeMs: Math.floor(stat.mtimeMs),
      });
    }
  }
  await walk(root);
  return {
    files: files.sort((left, right) => left.path.localeCompare(right.path)),
    incompleteScan,
  };
}

async function readPackageJson(root) {
  return readJson(path.join(root, "package.json")).catch(() => null);
}

async function detectWorkspaces(root, packageData, sourceFiles) {
  const declared = Array.isArray(packageData?.workspaces)
    ? packageData.workspaces
    : Array.isArray(packageData?.workspaces?.packages)
      ? packageData.workspaces.packages
      : [];
  const packagePaths = new Set(["package.json"]);
  for (const file of sourceFiles) {
    if (file.path.endsWith("/package.json")) packagePaths.add(file.path);
  }
  const workspacePaths =
    declared.length > 0 ? declared : [...packagePaths].filter((file) => file !== "package.json");
  const packages = [];
  for (const relativePackagePath of packagePaths) {
    if (relativePackagePath === "package.json") continue;
    const packagePath = path.join(root, relativePackagePath);
    const relativeDirectory = path.posix.dirname(relativePackagePath);
    if (
      declared.length > 0 &&
      !workspacePaths.some((pattern) => matchesWorkspacePattern(relativeDirectory, pattern))
    ) {
      continue;
    }
    const data = await readJson(packagePath).catch(() => null);
    if (!data) continue;
    packages.push({
      path: relativeDirectory,
      name: data.name ?? relativeDirectory,
      commands: sanitizeCommands(data.scripts ?? {}),
    });
  }
  return {
    declared: declared.length > 0,
    packages: packages.sort((left, right) => left.path.localeCompare(right.path)),
  };
}

function matchesWorkspacePattern(relativeDirectory, pattern) {
  const normalized = String(pattern).replaceAll("\\", "/").replace(/\/$/, "");
  if (normalized.endsWith("/*")) return relativeDirectory.startsWith(`${normalized.slice(0, -2)}/`);
  return relativeDirectory === normalized;
}

async function detectNestedRepositories(root) {
  const found = [];
  async function walk(current, relativeDirectory = "") {
    if (found.length >= 100) return;
    const entries = await fs.readdir(current, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.name === ".git" || GENERATED_DIRS.includes(entry.name)) continue;
      if (!entry.isDirectory()) continue;
      const relative = path.join(relativeDirectory, entry.name).split(path.sep).join("/");
      if (await directoryExists(path.join(current, entry.name, ".git"))) found.push(relative);
      await walk(path.join(current, entry.name), relative);
    }
  }
  await walk(root);
  return found.sort();
}

async function directoryExists(target) {
  try {
    return (await fs.stat(target)).isDirectory();
  } catch {
    return false;
  }
}

async function readGitValue(root, args) {
  try {
    const result = await execFileAsync("git", args, {
      cwd: root,
      timeout: 1000,
      maxBuffer: 16 * 1024,
    });
    return result.stdout.trim().replace(/^refs\/remotes\/origin\//, "") || null;
  } catch {
    return null;
  }
}

function detectLanguages(files) {
  return [
    ...new Set(
      files
        .map((file) => LANGUAGE_BY_EXTENSION[path.extname(file.path).toLowerCase()])
        .filter(Boolean),
    ),
  ].sort();
}

function detectStack(packageData) {
  return [
    ...new Set([
      ...(packageData?.dependencies ? Object.keys(packageData.dependencies) : []),
      ...(packageData?.devDependencies ? Object.keys(packageData.devDependencies) : []),
    ]),
  ]
    .filter((name) =>
      [
        "next",
        "react",
        "vue",
        "svelte",
        "typescript",
        "vite",
        "express",
        "fastify",
        "trpc",
        "zod",
      ].includes(name),
    )
    .sort();
}

function detectFrameworks(packageData) {
  return detectStack(packageData).filter((name) => !["typescript", "zod", "trpc"].includes(name));
}

function detectPackageManager(files) {
  if (files.some((file) => file.path === "pnpm-lock.yaml")) return "pnpm";
  if (files.some((file) => file.path === "yarn.lock")) return "yarn";
  if (files.some((file) => file.path === "bun.lockb" || file.path === "bun.lock")) return "bun";
  if (files.some((file) => file.path === "package-lock.json")) return "npm";
  return null;
}

function sanitizeCommands(commands) {
  return Object.fromEntries(
    Object.entries(commands).map(([name, command]) => [name, sanitizeText(command)]),
  );
}

function sanitizeText(value) {
  return String(value).replace(
    /((?:^|\s)[A-Z][A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PRIVATE|CREDENTIAL|KEY)[A-Z0-9_]*=)(?:"[^"]*"|'[^']*'|\S+)/gi,
    "$1[REDACTED]",
  );
}

function sanitizeRemote(value) {
  if (!value) return null;
  try {
    const remote = new URL(value);
    remote.username = "";
    remote.password = "";
    for (const key of [...remote.searchParams.keys()]) {
      if (/(token|secret|password|key|credential|auth)/i.test(key)) remote.searchParams.delete(key);
    }
    return remote.toString().replace(/\/$/, "");
  } catch {
    return value.replace(/:[^/@\s]+@/, ":[REDACTED]@");
  }
}

function detectEntrypoints(files) {
  return files
    .map((file) => file.path)
    .filter((file) => /^(src\/)?(index|main|cli)\.(c?m?js|ts|tsx)$/.test(file))
    .slice(0, 20);
}

function detectImportantDocs(files) {
  const known = new Set([
    "README.md",
    "AGENTS.md",
    "CLAUDE.md",
    "GEMINI.md",
    "CONTRIBUTING.md",
    "docs/architecture.md",
  ]);
  return files.map((file) => file.path).filter((file) => known.has(file));
}

function detectVendorIntegrations(files) {
  const paths = files.map((file) => file.path);
  const matches = [];
  if (paths.some((file) => file === "AGENTS.md" || file.startsWith(".codex/")))
    matches.push("codex-cli");
  if (paths.some((file) => file === "CLAUDE.md" || file.startsWith(".claude/")))
    matches.push("claude-code");
  if (paths.some((file) => file.startsWith(".cursor/"))) matches.push("cursor");
  if (paths.some((file) => file === "GEMINI.md" || file.startsWith(".gemini/")))
    matches.push("gemini-cli");
  if (paths.some((file) => file.startsWith(".openclaw/") || file === "openclaw.json"))
    matches.push("openclaw");
  if (paths.some((file) => file.startsWith(".pi/"))) matches.push("pi");
  return matches;
}

function hashSourceFiles(files) {
  return createHash("sha256").update(JSON.stringify(files)).digest("hex");
}

function createCanonicalFacts(index) {
  const candidates = [
    ["project", "name", index.project.name],
    ["project", "stack", index.project.stack],
    ["project", "languages", index.languages],
    ["project", "frameworks", index.frameworks],
    ["project", "package_manager", index.packageManager],
    ["project", "commands", index.commands],
    ["project", "vendors", index.vendorIntegrations],
    ["project", "workspaces", index.workspaces],
  ];
  return deduplicateCanonicalFacts(
    candidates.map(([kind, key, value]) => {
      const normalized = stableValue({ kind, key, value });
      const id = `fact-${createHash("sha256").update(JSON.stringify(normalized)).digest("hex").slice(0, 16)}`;
      return {
        id,
        kind,
        key,
        value,
        authority: "source_truth",
        source: "repository-filesystem",
        sourceHash: index.freshness.sourceHash,
        provenance: {
          type: key === "commands" ? "command" : "file",
          paths: factSourcePaths(index, key),
          checkedAt: index.freshness.checkedAt,
        },
      };
    }),
  );
}

function factSourcePaths(index, key) {
  if (["name", "stack", "commands", "package_manager"].includes(key)) {
    return index.sourceFiles
      .filter(
        (file) =>
          file.path === "package.json" ||
          /package-lock\.json$|pnpm-lock\.yaml$|yarn\.lock$|bun\.lockb$/.test(file.path),
      )
      .map((file) => file.path)
      .sort((left, right) =>
        left === "package.json" ? -1 : right === "package.json" ? 1 : left.localeCompare(right),
      );
  }
  if (key === "vendors")
    return index.sourceFiles
      .filter((file) =>
        /^(AGENTS\.md|CLAUDE\.md|GEMINI\.md|openclaw\.json|\.(codex|claude|cursor|gemini|openclaw|pi)\/)/.test(
          file.path,
        ),
      )
      .map((file) => file.path);
  return index.sourceFiles.map((file) => file.path);
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])]),
  );
}

function diffSourceFiles(previous, current) {
  const oldFiles = new Map(
    (previous ?? []).map((file) => [file.path, `${file.size}:${file.mtimeMs}`]),
  );
  const changed = [];
  for (const file of current) {
    if (oldFiles.get(file.path) !== `${file.size}:${file.mtimeMs}`) changed.push(file.path);
    oldFiles.delete(file.path);
  }
  return changed.concat([...oldFiles.keys()].map((file) => `deleted:${file}`)).slice(0, 100);
}
