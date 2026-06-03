import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import { readJson, writeFileIfMissing, writeJson } from "../fs-utils.js";
import { getRuntimeStatePath } from "../paths.js";
import { redactProviderBoundText, seedRedactionVault } from "./redaction-gateway.js";

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

  const result = spawnSync("/bin/sh", ["-lc", command], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MA_ARCHITECT_REVIEW_PROMPT: redactedPrompt.sanitizedText,
      MA_ARCHITECT_REVIEW_PROMPT_FILE: promptPath,
      MA_ARCHITECT_REVIEW_OUTPUT: outputPath,
    },
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(
      result.stderr?.trim() || result.stdout?.trim() || "External architect review failed",
    );
  }

  const parsed = JSON.parse(await fs.readFile(outputPath, "utf8"));
  const review = {
    schemaVersion: "0.1.0",
    verdict: parsed.verdict ?? "UNKNOWN",
    reviewer: parsed.reviewer ?? "external",
    summary: parsed.summary ?? null,
    findings: Array.isArray(parsed.findings) ? parsed.findings : [],
    reviewedAt: new Date().toISOString(),
  };
  await saveArchitectReview(review);
  return review;
}
