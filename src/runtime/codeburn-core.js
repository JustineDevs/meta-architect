import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ensureDir, readJson, writeFileIfMissing, writeJson } from "../fs-utils.js";
import { getRuntimeSubsystemPath } from "../paths.js";

const execFileAsync = promisify(execFile);
export const codeburnSchemaVersion = "0.1.0";

export function getCodeburnRoot() {
  return getRuntimeSubsystemPath("context");
}

export function getCodeburnLogPath() {
  return getRuntimeSubsystemPath("context", "codeburn-usage.json");
}

export function createDefaultCodeburnUsage() {
  return { schemaVersion: codeburnSchemaVersion, entries: [], totalTokens: 0, totalCost: 0 };
}

function validateUsage(value) {
  if (
    !value ||
    typeof value !== "object" ||
    value.schemaVersion !== codeburnSchemaVersion ||
    !Array.isArray(value.entries) ||
    !Number.isFinite(value.totalTokens) ||
    !Number.isFinite(value.totalCost)
  ) {
    throw new Error("codeburn usage has an invalid schema");
  }
  return value;
}

export async function seedCodeburnArtifacts() {
  await ensureDir(getCodeburnRoot());
  await writeFileIfMissing(
    getCodeburnLogPath(),
    `${JSON.stringify(createDefaultCodeburnUsage(), null, 2)}\n`,
  );
}

export async function loadCodeburnUsage() {
  return validateUsage(await readJson(getCodeburnLogPath()));
}

function parseCodeburnOutput(output) {
  const text = String(output ?? "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : (parsed.entries ?? [parsed]);
  } catch {
    const jsonLine = text
      .split("\n")
      .map((line) => line.trim())
      .reverse()
      .find((line) => line.startsWith("{") || line.startsWith("["));
    if (!jsonLine) throw new Error("codeburn returned no JSON usage data");
    const parsed = JSON.parse(jsonLine);
    return Array.isArray(parsed) ? parsed : (parsed.entries ?? [parsed]);
  }
}

function normalizeEntry(entry) {
  const inputTokens = Number(entry.inputTokens ?? entry.input_tokens ?? 0);
  const outputTokens = Number(entry.outputTokens ?? entry.output_tokens ?? 0);
  const tokens = Number(
    entry.totalTokens ?? entry.total_tokens ?? entry.tokens ?? inputTokens + outputTokens,
  );
  const cost = Number(entry.totalCost ?? entry.total_cost ?? entry.cost ?? 0);
  return {
    provider: entry.provider ?? null,
    model: entry.model ?? entry.modelName ?? null,
    sessionId: entry.sessionId ?? entry.session_id ?? null,
    tokens: Number.isFinite(tokens) && tokens >= 0 ? tokens : 0,
    cost: Number.isFinite(cost) && cost >= 0 ? cost : 0,
  };
}

export async function syncCodeburnUsage({
  cwd = process.cwd(),
  command,
  args,
  exec = execFileAsync,
} = {}) {
  const existing = await loadCodeburnUsage();
  const executable = command ?? process.env.MA_CODEBURN_BIN ?? "npx";
  const commandArgs = args ?? ["--yes", "codeburn", "usage", "--json"];
  try {
    const result = await exec(executable, commandArgs, { cwd, encoding: "utf8", timeout: 15_000 });
    const entries = parseCodeburnOutput(result.stdout ?? result);
    const normalized = entries
      .filter((entry) => entry && typeof entry === "object")
      .map(normalizeEntry);
    const usage = {
      schemaVersion: codeburnSchemaVersion,
      entries: normalized,
      totalTokens: normalized.reduce((sum, entry) => sum + entry.tokens, 0),
      totalCost: normalized.reduce((sum, entry) => sum + entry.cost, 0),
      syncedAt: new Date().toISOString(),
    };
    await writeJson(getCodeburnLogPath(), usage);
    return { available: true, usage };
  } catch (error) {
    return {
      available: false,
      usage: existing,
      reason: error instanceof Error ? error.message : "codeburn unavailable",
    };
  }
}
