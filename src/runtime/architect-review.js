import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { readJson, writeFileIfMissing, writeJson } from "../fs-utils.js";
import { getRuntimeStatePath } from "../paths.js";
import {
  maskSensitiveText,
  redactProviderBoundPayload,
  redactProviderBoundText,
  seedRedactionVault,
} from "./redaction-gateway.js";

const REVIEW_POLICY_PATH = path.join(".ma", "architect-review-policy.json");
const DEFAULT_REVIEW_TIMEOUT_MS = 120000;
const MAX_REVIEW_OUTPUT_BYTES = 1024 * 1024;

export function getArchitectReviewPath() {
  return getRuntimeStatePath("architect-review.json");
}

export function createDefaultArchitectReview() {
  return {
    schemaVersion: "0.1.0",
    verdict: "NOT_RUN",
    reviewer: null,
    summary: null,
    findings: [],
    reviewedAt: null,
  };
}

export async function seedArchitectReviewArtifacts() {
  await writeFileIfMissing(
    getArchitectReviewPath(),
    `${JSON.stringify(createDefaultArchitectReview(), null, 2)}\n`,
  );
}

export async function loadArchitectReviewOrDefault() {
  try {
    return await readJson(getArchitectReviewPath());
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return createDefaultArchitectReview();
    }

    throw error;
  }
}

export async function saveArchitectReview(review) {
  await writeJson(getArchitectReviewPath(), review);
  return review;
}

export async function runExternalArchitectReview({ prompt = "" } = {}) {
  const command = process.env.MA_ARCHITECT_REVIEW_CMD?.trim();
  if (!command) {
    throw new Error("External architect review is not configured. Set MA_ARCHITECT_REVIEW_CMD.");
  }

  await seedRedactionVault();
  const redactedPrompt = await redactProviderBoundText(prompt, {
    kind: "architect-review-prompt",
  });
  const promptPath = getRuntimeStatePath("architect-review.prompt.md");
  const outputPath = getRuntimeStatePath("architect-review.output.json");
  await fs.writeFile(promptPath, `${redactedPrompt.sanitizedText.trimEnd()}\n`, "utf8");

  const { command: binary, args } = parseTrustedCommand(
    command,
    redactedPrompt.sanitizedText,
    getArchitectReviewConfiguration(),
  );
  const timeout = readReviewTimeoutMs();
  const result = spawnSync(binary, args, {
    cwd: process.cwd(),
    env: buildArchitectReviewEnv({
      MA_ARCHITECT_REVIEW_PROMPT: redactedPrompt.sanitizedText,
      MA_ARCHITECT_REVIEW_PROMPT_FILE: promptPath,
      MA_ARCHITECT_REVIEW_OUTPUT: outputPath,
    }),
    encoding: "utf8",
    shell: false,
    timeout,
    maxBuffer: MAX_REVIEW_OUTPUT_BYTES,
    killSignal: "SIGKILL",
  });

  if (result.error) {
    await writeReviewReceipt({
      status: "failed",
      command: binary,
      timeout,
      error: result.error.message,
    });
    throw new Error(`External architect review failed: ${result.error.message}`);
  }

  if (result.status !== 0) {
    await writeReviewReceipt({
      status: "failed",
      command: binary,
      timeout,
      code: result.status,
      stderr: result.stderr,
    });
    throw new Error(
      maskSensitiveText(
        result.stderr?.trim() || result.stdout?.trim() || "External architect review failed",
      ).sanitizedText,
    );
  }

  let outputStat;
  try {
    outputStat = await fs.stat(outputPath);
  } catch {
    await writeReviewReceipt({
      status: "failed",
      command: binary,
      timeout,
      error: "reviewer did not produce the configured JSON output",
    });
    throw new Error("External architect review did not produce JSON output");
  }
  if (outputStat.size > MAX_REVIEW_OUTPUT_BYTES) {
    await writeReviewReceipt({
      status: "failed",
      command: binary,
      timeout,
      error: `review output exceeds ${MAX_REVIEW_OUTPUT_BYTES} bytes`,
    });
    throw new Error(`External architect review output exceeds ${MAX_REVIEW_OUTPUT_BYTES} bytes`);
  }
  const parsed = JSON.parse(await fs.readFile(outputPath, "utf8"));
  const safeOutput = await redactProviderBoundPayload(parsed, {
    kind: "architect-review-output",
  });
  const sanitized = safeOutput.sanitizedPayload;
  const review = {
    schemaVersion: "0.1.0",
    verdict: sanitized.verdict ?? "UNKNOWN",
    reviewer: sanitized.reviewer ?? "external",
    summary: sanitized.summary ?? null,
    findings: Array.isArray(sanitized.findings) ? sanitized.findings : [],
    reviewedAt: new Date().toISOString(),
  };
  await saveArchitectReview(review);
  await writeReviewReceipt({
    status: "completed",
    command: binary,
    timeout,
    verdict: review.verdict,
  });
  return review;
}

export function getArchitectReviewConfiguration(root = process.env.MA_ROOT ?? process.cwd()) {
  const allowedCommands = new Set(
    (process.env.MA_ARCHITECT_REVIEW_ALLOWLIST ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const policyPath = path.join(root, REVIEW_POLICY_PATH);
  try {
    const policy = JSON.parse(readFileSync(policyPath, "utf8"));
    for (const value of policy.allowedCommands ?? []) {
      if (typeof value === "string" && value.trim()) allowedCommands.add(value.trim());
    }
    return { allowedCommands: [...allowedCommands], policyPath, source: "environment+project" };
  } catch {
    return {
      allowedCommands: [...allowedCommands],
      policyPath,
      source: allowedCommands.size > 0 ? "environment" : "none",
    };
  }
}

function parseTrustedCommand(command, promptText, configuration = {}) {
  if (/[;&|`<>]/.test(command)) {
    throw new Error("MA_ARCHITECT_REVIEW_CMD must not contain shell metacharacters");
  }

  const parts = splitCommand(command);
  if (parts.length === 0) {
    throw new Error("MA_ARCHITECT_REVIEW_CMD is empty");
  }

  if (parts[0].includes("=") && !parts[0].includes("/")) {
    throw new Error("MA_ARCHITECT_REVIEW_CMD must start with an executable");
  }

  const substituted = parts.map((part) => part.replaceAll("{prompt}", promptText));
  const configured = new Set(configuration.allowedCommands ?? []);
  const commandName = path.basename(substituted[0]);
  if (!configured.has(substituted[0]) && !configured.has(commandName)) {
    throw new Error(
      `MA_ARCHITECT_REVIEW_CMD is not allowlisted: ${substituted[0]}. ` +
        "Add its exact command or basename to MA_ARCHITECT_REVIEW_ALLOWLIST or .ma/architect-review-policy.json.",
    );
  }
  return {
    command: substituted[0],
    args: substituted.slice(1),
  };
}

function readReviewTimeoutMs() {
  const parsed = Number(process.env.MA_ARCHITECT_REVIEW_TIMEOUT_MS);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_REVIEW_TIMEOUT_MS;
  return Math.min(120000, Math.max(1000, Math.floor(parsed)));
}

async function writeReviewReceipt(details) {
  const receiptDir = path.join(
    process.env.MA_ROOT ?? process.cwd(),
    ".ma",
    "evidence",
    "architect-review-receipts",
  );
  const safeDetails = { ...details };
  for (const key of ["error", "stderr"]) {
    if (safeDetails[key])
      safeDetails[key] = maskSensitiveText(String(safeDetails[key])).sanitizedText;
  }
  await fs.mkdir(receiptDir, { recursive: true }).catch(() => {});
  await fs
    .writeFile(
      path.join(receiptDir, `review-${Date.now()}-${process.pid}.json`),
      `${JSON.stringify(
        {
          schemaVersion: "0.1.0",
          record_type: "architect_review_receipt",
          generatedAt: new Date().toISOString(),
          ...safeDetails,
        },
        null,
        2,
      )}\n`,
      { mode: 0o600 },
    )
    .catch(() => {});
}

function buildArchitectReviewEnv(extraEnv = {}) {
  const passthroughKeys = new Set([
    "PATH",
    "HOME",
    "USERPROFILE",
    "TMPDIR",
    "TMP",
    "TEMP",
    "LANG",
    "LC_ALL",
    "SYSTEMROOT",
    "COMSPEC",
    "MA_ROOT",
  ]);
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (passthroughKeys.has(key)) {
      env[key] = value;
    }
  }
  return { ...env, ...extraEnv };
}

function splitCommand(command) {
  const parts = [];
  let current = "";
  let quote = null;
  let escaping = false;

  for (const char of command) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (char === "\\") {
      escaping = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        parts.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (escaping) {
    current += "\\";
  }
  if (quote) {
    throw new Error("MA_ARCHITECT_REVIEW_CMD has an unterminated quote");
  }
  if (current) {
    parts.push(current);
  }

  return parts;
}
