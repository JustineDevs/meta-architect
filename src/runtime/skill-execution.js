import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getRuntimeSubsystemPath } from "../paths.js";
import { writeJsonAtomically } from "../setup-lifecycle.js";
import { validateSkillCompositionPlan } from "./skill-capability-broker.js";

export const skillExecutionSchemaVersion = "0.1.0";
const defaultMaxSkillBytes = 256_000;

export function createSkillExecutionReference(execution) {
  if (!execution || typeof execution !== "object") return null;
  return validateSkillExecutionReference({
    schemaVersion: execution.schemaVersion,
    recordType: execution.recordType,
    status: execution.status,
    receiptPath: execution.receiptPath,
    order: execution.order,
    instructionCount: execution.instructionCount,
    sourceMutation: execution.sourceMutation,
    thirdPartyCommandExecution: execution.thirdPartyCommandExecution,
    hostReceiptRequiredForVendorClaim: execution.hostReceiptRequiredForVendorClaim,
  });
}

export function validateSkillExecutionReference(reference) {
  if (reference === null || reference === undefined) return null;
  if (!reference || typeof reference !== "object" || Array.isArray(reference))
    throw new Error("skill execution reference must be an object or null");
  if (reference.schemaVersion !== skillExecutionSchemaVersion)
    throw new Error("invalid skill execution schema");
  if (reference.recordType !== "skill_execution_receipt")
    throw new Error("invalid skill execution record type");
  if (!new Set(["loaded", "blocked"]).has(reference.status))
    throw new Error("invalid skill execution status");
  if (typeof reference.receiptPath !== "string" || reference.receiptPath.trim() === "")
    throw new Error("skill execution receiptPath is required");
  if (!Array.isArray(reference.order) || reference.order.some((value) => typeof value !== "string"))
    throw new Error("skill execution order must be a string array");
  if (!Number.isInteger(reference.instructionCount) || reference.instructionCount < 0)
    throw new Error("skill execution instructionCount must be a non-negative integer");
  for (const field of [
    "sourceMutation",
    "thirdPartyCommandExecution",
    "hostReceiptRequiredForVendorClaim",
  ])
    if (typeof reference[field] !== "boolean")
      throw new Error(`skill execution ${field} must be boolean`);
  return { ...reference, order: [...reference.order] };
}

function resolveCandidateRoot(sourcePath, cwd, home) {
  const source = String(sourcePath ?? "");
  if (source.startsWith("~/")) return path.join(home, source.slice(2));
  if (source.startsWith("package://@jstn-sdk/ma")) return path.resolve(cwd, "skills");
  if (path.isAbsolute(source)) return path.resolve(source);
  return path.resolve(cwd, source);
}

function executionReceiptPath(taskId) {
  const safeId = String(taskId ?? "adhoc")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .slice(0, 120);
  return getRuntimeSubsystemPath(
    "tasks",
    "skill-execution-receipts",
    `${safeId}-${Date.now()}.json`,
  );
}

async function readSkill(candidate, { cwd, home, maxSkillBytes }) {
  if (candidate.capabilityType !== "skill") {
    return {
      status: "skipped",
      reason: "Only SKILL.md instruction surfaces are executable by the MA context loader",
    };
  }
  const root = resolveCandidateRoot(candidate.sourcePath, cwd, home);
  const entrypoint = path.join(root, candidate.entrypoint || "SKILL.md");
  const normalizedRoot = path.resolve(root);
  const normalizedEntrypoint = path.resolve(entrypoint);
  if (
    normalizedEntrypoint !== normalizedRoot &&
    !normalizedEntrypoint.startsWith(`${normalizedRoot}${path.sep}`)
  ) {
    return {
      status: "blocked",
      reason: `Skill entrypoint escapes its source root: ${candidate.name}`,
    };
  }
  const realRoot = await fs.realpath(normalizedRoot).catch(() => null);
  const realEntrypoint = await fs.realpath(normalizedEntrypoint).catch(() => null);
  if (
    !realRoot ||
    !realEntrypoint ||
    (realEntrypoint !== realRoot && !realEntrypoint.startsWith(`${realRoot}${path.sep}`))
  ) {
    return {
      status: "blocked",
      reason: `Skill entrypoint escapes its source root: ${candidate.name}`,
    };
  }
  const stat = await fs.stat(entrypoint).catch(() => null);
  if (!stat?.isFile()) {
    return { status: "blocked", reason: `Skill entrypoint is unavailable: ${candidate.name}` };
  }
  if (stat.size > maxSkillBytes) {
    return {
      status: "blocked",
      reason: `Skill entrypoint exceeds the ${maxSkillBytes}-byte execution context limit: ${candidate.name}`,
    };
  }
  const content = await fs.readFile(entrypoint, "utf8");
  if (!content.trim())
    return { status: "blocked", reason: `Skill entrypoint is empty: ${candidate.name}` };
  return {
    status: "loaded",
    sourcePath: candidate.sourcePath,
    entrypoint: candidate.entrypoint || "SKILL.md",
    bytes: Buffer.byteLength(content),
    content,
  };
}

/**
 * Loads selected skill instructions into a bounded MA execution packet.
 * Loading is the executable operation for instruction skills; it never runs
 * arbitrary third-party commands or mutates their source files.
 */
export async function executeSkillCompositionPlan({
  plan,
  taskId = null,
  vendor = null,
  cwd = process.cwd(),
  home = os.homedir(),
  hostReceipt = null,
  maxSkillBytes = defaultMaxSkillBytes,
} = {}) {
  validateSkillCompositionPlan(plan);
  if (!Number.isInteger(maxSkillBytes) || maxSkillBytes < 1) {
    throw new Error("maxSkillBytes must be a positive integer");
  }
  const startedAt = new Date().toISOString();
  const results = [];
  const instructions = [];
  for (const candidate of plan.selected) {
    const result = await readSkill(candidate, { cwd, home, maxSkillBytes });
    const record = {
      name: candidate.name,
      capabilityType: candidate.capabilityType,
      scope: candidate.scope,
      reason: candidate.reason,
      status: result.status,
      sourcePath: result.sourcePath ?? candidate.sourcePath,
      entrypoint: result.entrypoint ?? candidate.entrypoint,
      bytes: result.bytes ?? 0,
      error: result.status === "loaded" ? null : result.reason,
      executionBoundary: "instruction_context",
      mutationAllowed: false,
      hostReceipt: hostReceipt ? "provided" : "not_provided",
    };
    results.push(record);
    if (result.status === "loaded") {
      instructions.push({ name: candidate.name, content: result.content });
    }
  }
  const blocked = results.filter((result) => result.status === "blocked");
  const receipt = {
    schemaVersion: skillExecutionSchemaVersion,
    recordType: "skill_execution_receipt",
    taskId: taskId ? String(taskId) : null,
    vendor: vendor ? String(vendor) : null,
    order: results.map((result) => result.name),
    status: blocked.length > 0 ? "blocked" : "loaded",
    execution: results,
    instructionCount: instructions.length,
    startedAt,
    completedAt: new Date().toISOString(),
    sourceMutation: false,
    thirdPartyCommandExecution: false,
    hostReceiptRequiredForVendorClaim: true,
  };
  const receiptPath = executionReceiptPath(taskId);
  await writeJsonAtomically(receiptPath, receipt);
  return {
    ...receipt,
    receiptPath,
    instructions,
    evidence: [
      `skill execution receipt: ${receiptPath}`,
      `loaded instructions: ${instructions.length}`,
    ],
  };
}
