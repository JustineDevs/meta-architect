import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { ensureDir, readJson, writeFileIfMissing, writeJson } from "../fs-utils.js";
import { getRepoRoot, getRuntimeSubsystemPath, getRuntimeWritePath } from "../paths.js";
import { safeSpawn } from "../process-utils.js";

export const coreSourceIngestSchemaVersion = "0.1.0";

export const coreSourceDefinitions = [
  {
    id: "obsidian-api",
    capability: "obsidian_integration_core",
    source_type: "external_clone",
    repo: "obsidianmd/obsidian-api",
    source_url: "https://github.com/obsidianmd/obsidian-api.git",
    local_dir: "obsidian-api",
    semantic_role: "obsidian_api_contract",
    records_as: "core_source_snapshot",
  },
  {
    id: "obsidian-sample-plugin",
    capability: "obsidian_integration_core",
    source_type: "external_clone",
    repo: "obsidianmd/obsidian-sample-plugin",
    source_url: "https://github.com/obsidianmd/obsidian-sample-plugin.git",
    local_dir: "obsidian-sample-plugin",
    semantic_role: "obsidian_plugin_compatibility_reference",
    records_as: "core_source_snapshot",
  },
  {
    id: "caveman",
    capability: "context_economy_core",
    source_type: "external_clone",
    repo: "JuliusBrussee/caveman",
    source_url: "https://github.com/JuliusBrussee/caveman.git",
    local_dir: "caveman",
    semantic_role: "context_compression_contract",
    records_as: "core_source_snapshot",
  },
  {
    id: "prompt-engineering",
    capability: "prompt_strategy_core",
    source_type: "external_clone",
    repo: "NirDiamant/Prompt_Engineering",
    source_url: "https://github.com/NirDiamant/Prompt_Engineering.git",
    local_dir: "prompt-engineering",
    semantic_role: "prompt_technique_catalog",
    records_as: "core_source_snapshot",
  },
  {
    id: "ralph-execution-core",
    capability: "ralph_execution_core",
    source_type: "ma_owned_core",
    repo: "meta-architect/ralph-execution-core",
    source_url: null,
    local_dir: null,
    semantic_role: "story_execution_contract",
    records_as: "ma_core_contract",
    local_paths: ["src/runtime/ralph-execution-core.js", "scripts/ralph/prompt.md"],
  },
];

export function getCoreSourcesRootPath() {
  return getRuntimeWritePath("core-sources");
}

export function getCoreSourceIngestPath() {
  return getRuntimeSubsystemPath("context", "core-source-ingest.json");
}

export function createDefaultCoreSourceIngest() {
  return {
    schemaVersion: coreSourceIngestSchemaVersion,
    record_type: "core_source_ingest",
    product: "Meta-Architect",
    purpose:
      "Canonical MA core source snapshots. External projects are cloned/cached once, then MA reads local snapshots instead of fetching on every run.",
    runtime_fetch_required: false,
    refresh_policy: "manual_refresh_via_ma_core_ingest",
    records_as: "core_source_snapshot",
    sources: coreSourceDefinitions.map((definition) => ({
      id: definition.id,
      capability: definition.capability,
      source_type: definition.source_type,
      repo: definition.repo,
      source_url: definition.source_url,
      semantic_role: definition.semantic_role,
      records_as: definition.records_as,
      status: "NOT_INGESTED",
      local_path: definition.local_dir
        ? path.join(".ma", "core-sources", definition.local_dir)
        : null,
      file_count: 0,
      content_sha256: null,
      git_commit: null,
      sampled_files: [],
      sample_text: null,
    })),
    hard_rules: [
      "Obsidian, Caveman, Prompt Strategy, and Ralph are MA semantic cores, not MCP servers.",
      "GitMCP or git remotes may refresh provenance, but core behavior reads local source snapshots.",
      "Obsidian-derived claims remain vault_context unless promoted by an owning MA lane.",
      "Ralph Execution Core is MA-owned and cannot mutate release or decision state directly.",
    ],
  };
}

export function validateCoreSourceIngest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("core source ingest must be an object");
  }
  if (value.schemaVersion !== coreSourceIngestSchemaVersion) {
    throw new Error(`Unsupported core source ingest schemaVersion: ${value.schemaVersion}`);
  }
  if (value.record_type !== "core_source_ingest") {
    throw new Error("core source ingest requires record_type=core_source_ingest");
  }
  if (value.runtime_fetch_required !== false) {
    throw new Error("core source ingest must not require runtime fetches");
  }
  if (!Array.isArray(value.sources) || value.sources.length < coreSourceDefinitions.length) {
    throw new Error("core source ingest requires all core source entries");
  }
  const byId = new Map(value.sources.map((source) => [source.id, source]));
  for (const definition of coreSourceDefinitions) {
    const source = byId.get(definition.id);
    if (!source) {
      throw new Error(`core source ingest missing ${definition.id}`);
    }
    if (source.capability !== definition.capability) {
      throw new Error(`core source ${definition.id} capability mismatch`);
    }
    if (source.records_as !== definition.records_as) {
      throw new Error(`core source ${definition.id} records_as mismatch`);
    }
  }
  return value;
}

export async function seedCoreSourceIngestArtifacts() {
  await ensureDir(getRuntimeSubsystemPath("context"));
  await writeFileIfMissing(
    getCoreSourceIngestPath(),
    `${JSON.stringify(createDefaultCoreSourceIngest(), null, 2)}\n`,
  );
}

export async function loadCoreSourceIngest() {
  return validateCoreSourceIngest(await readJson(getCoreSourceIngestPath()));
}

export async function ingestCoreSources({
  definitions = coreSourceDefinitions,
  refresh = false,
  spawnImpl = safeSpawn,
} = {}) {
  await ensureDir(getCoreSourcesRootPath());
  const sources = [];
  const errors = [];

  for (const definition of definitions) {
    try {
      if (definition.source_type === "ma_owned_core") {
        sources.push(await inspectMaOwnedCore(definition));
        continue;
      }

      const localPath = path.join(getCoreSourcesRootPath(), definition.local_dir);
      if (refresh) {
        await fs.rm(localPath, { recursive: true, force: true });
      }
      if (!(await pathExists(localPath))) {
        await cloneSource(definition.source_url, localPath, spawnImpl);
      }
      sources.push(await inspectExternalCore(definition, localPath));
    } catch (error) {
      errors.push({ id: definition.id, repo: definition.repo, error: error.message });
      sources.push(createFailedSource(definition, error));
    }
  }

  const manifest = validateCoreSourceIngest({
    ...createDefaultCoreSourceIngest(),
    ingested_at: new Date().toISOString(),
    status: errors.length === 0 ? "READY" : "PARTIAL",
    sources,
    errors,
  });
  await writeJson(getCoreSourceIngestPath(), manifest);
  return manifest;
}

export function findIngestedCoreSourceForRepo(manifest, repo) {
  if (!manifest?.sources || !repo) return null;
  return manifest.sources.find(
    (source) => source.repo === repo && ["INGESTED", "LOCAL_CORE"].includes(source.status),
  );
}

async function inspectExternalCore(definition, localPath) {
  const files = await listSourceFiles(localPath);
  const sampledFiles = chooseSampleFiles(files);
  const sampleText = await readSampleText(localPath, sampledFiles);
  const gitCommit = await readGitCommit(localPath);
  return {
    id: definition.id,
    capability: definition.capability,
    source_type: definition.source_type,
    repo: definition.repo,
    source_url: definition.source_url,
    semantic_role: definition.semantic_role,
    records_as: definition.records_as,
    status: "INGESTED",
    local_path: path.relative(getRepoRoot(), localPath),
    file_count: files.length,
    content_sha256: hashFileList(files),
    git_commit: gitCommit,
    sampled_files: sampledFiles,
    sample_text: sampleText,
  };
}

async function inspectMaOwnedCore(definition) {
  const repoRoot = getRepoRoot();
  const files = [];
  for (const relativePath of definition.local_paths ?? []) {
    const absolutePath = path.join(repoRoot, relativePath);
    if (await pathExists(absolutePath)) {
      const stat = await fs.stat(absolutePath);
      files.push({
        relative_path: relativePath,
        size: stat.size,
        mtimeMs: Math.floor(stat.mtimeMs),
      });
    }
  }
  const samplePath = files[0]?.relative_path;
  const sampleText = samplePath
    ? (await fs.readFile(path.join(repoRoot, samplePath), "utf8")).slice(0, 600)
    : null;
  return {
    id: definition.id,
    capability: definition.capability,
    source_type: definition.source_type,
    repo: definition.repo,
    source_url: null,
    semantic_role: definition.semantic_role,
    records_as: definition.records_as,
    status: "LOCAL_CORE",
    local_path: null,
    file_count: files.length,
    content_sha256: hashFileList(files),
    git_commit: null,
    sampled_files: files.map((file) => file.relative_path),
    sample_text: sampleText,
  };
}

function createFailedSource(definition, error) {
  return {
    id: definition.id,
    capability: definition.capability,
    source_type: definition.source_type,
    repo: definition.repo,
    source_url: definition.source_url,
    semantic_role: definition.semantic_role,
    records_as: definition.records_as,
    status: "FAILED",
    local_path: definition.local_dir
      ? path.join(".ma", "core-sources", definition.local_dir)
      : null,
    file_count: 0,
    content_sha256: null,
    git_commit: null,
    sampled_files: [],
    sample_text: null,
    error: error.message,
  };
}

async function cloneSource(sourceUrl, localPath, spawnImpl) {
  await ensureDir(path.dirname(localPath));
  await new Promise((resolve, reject) => {
    const child = spawnImpl("git", ["clone", "--depth", "1", sourceUrl, localPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-2000);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`git clone failed for ${sourceUrl}: ${stderr.trim() || `exit ${code}`}`));
      }
    });
  });
}

async function listSourceFiles(rootPath) {
  const files = [];
  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;
      const stat = await fs.stat(absolutePath);
      files.push({
        relative_path: path.relative(rootPath, absolutePath).split(path.sep).join("/"),
        size: stat.size,
        mtimeMs: Math.floor(stat.mtimeMs),
      });
    }
  }
  await walk(rootPath);
  return files.sort((a, b) => a.relative_path.localeCompare(b.relative_path));
}

function chooseSampleFiles(files) {
  const preferred = [/^README\.md$/i, /^INSTALL\.md$/i, /^docs\//i, /SKILL\.md$/i, /prompt\.md$/i];
  const selected = [];
  for (const pattern of preferred) {
    const match = files.find((file) => pattern.test(file.relative_path));
    if (match && !selected.includes(match.relative_path)) {
      selected.push(match.relative_path);
    }
  }
  for (const file of files) {
    if (selected.length >= 4) break;
    if (!selected.includes(file.relative_path) && /\.(md|ts|js|json)$/i.test(file.relative_path)) {
      selected.push(file.relative_path);
    }
  }
  return selected;
}

async function readSampleText(rootPath, sampledFiles) {
  for (const relativePath of sampledFiles) {
    try {
      return (await fs.readFile(path.join(rootPath, relativePath), "utf8")).slice(0, 600);
    } catch {}
  }
  return null;
}

async function readGitCommit(localPath) {
  try {
    return (await fs.readFile(path.join(localPath, ".git", "shallow"), "utf8"))
      .trim()
      .split("\n")[0];
  } catch {
    return null;
  }
}

function hashFileList(files) {
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(`${file.relative_path}:${file.size}:${file.mtimeMs}\n`);
  }
  return hash.digest("hex");
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
