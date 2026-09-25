import path from "node:path";
import { ensureDir, readJson, writeJson } from "../fs-utils.js";
import { getRuntimeSubsystemPath } from "../paths.js";
import { createEngineeringPlan, validateEngineeringPlan } from "./engineering-policy.js";
import { validateSkillCompositionPlan } from "./skill-capability-broker.js";
import { validateSkillExecutionReference } from "./skill-execution.js";

export const taskContractSchemaVersion = "0.1.0";

export function getTaskContractRoot() {
  return getRuntimeSubsystemPath("tasks", "contracts");
}

function safeContractId(id) {
  if (String(id ?? "").includes("/") || String(id ?? "").includes("\\"))
    throw new Error("task contract id is required");
  const safe = String(id ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-");
  if (!safe || safe === "." || safe === "..") throw new Error("task contract id is required");
  return safe;
}

export function createTaskContract({
  goal,
  contextUsed = [],
  assumptions = [],
  constraints = [],
  risk = "medium",
  verification = [],
  stopCondition,
  persist = true,
  execution = null,
  priority = null,
  engineeringPlan = null,
  skillPlan = null,
  skillExecution = null,
}) {
  if (!goal || !stopCondition) throw new Error("task contract requires goal and stopCondition");
  const plan = engineeringPlan
    ? validateEngineeringPlan(engineeringPlan)
    : createEngineeringPlan({ goal, requestedPriority: priority, risk, verification });
  return validateTaskContract({
    schemaVersion: taskContractSchemaVersion,
    record_type: "task_contract",
    goal,
    context_used: contextUsed,
    assumptions,
    constraints,
    risk,
    verification,
    stop_condition: stopCondition,
    persist,
    execution: normalizeExecution(execution),
    priority: plan.triage.priority,
    engineering_plan: plan,
    skill_plan: skillPlan,
    skill_execution: skillExecution,
    created_at: new Date().toISOString(),
  });
}

const mutationModes = new Set(["read_only", "worktree", "source_write"]);

function normalizeCommand(command, label) {
  if (command === null || command === undefined) return null;
  if (!command || typeof command !== "object" || Array.isArray(command))
    throw new Error(`${label} must be an object`);
  if (typeof command.file !== "string" || command.file.trim() === "")
    throw new Error(`${label}.file is required`);
  if (!Array.isArray(command.args) || command.args.some((arg) => typeof arg !== "string"))
    throw new Error(`${label}.args must be a string array`);
  const timeoutMs = command.timeoutMs ?? 120_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 3_600_000)
    throw new Error(`${label}.timeoutMs must be between 1 and 3600000`);
  return { file: command.file, args: [...command.args], timeoutMs };
}

function normalizeExecution(execution) {
  if (execution === null || execution === undefined) return null;
  if (!execution || typeof execution !== "object" || Array.isArray(execution))
    throw new Error("task execution must be an object");
  const mutationMode = execution.mutation_mode ?? execution.mutationMode ?? "read_only";
  if (!mutationModes.has(mutationMode))
    throw new Error(`Unsupported mutation mode: ${mutationMode}`);
  if (typeof execution.workspace_root !== "string" || execution.workspace_root.trim() === "")
    throw new Error("task execution requires workspace_root");
  const allowedPaths = execution.allowed_paths ?? execution.allowedPaths ?? [];
  if (!Array.isArray(allowedPaths) || allowedPaths.some((value) => typeof value !== "string"))
    throw new Error("task execution allowed_paths must be a string array");
  if (allowedPaths.some((value) => value.trim() === "" || value.startsWith("/")))
    throw new Error("task execution allowed_paths must be non-empty relative paths");
  const command = normalizeCommand(execution.command, "task execution command");
  const verification = Array.isArray(execution.verification) ? execution.verification : [];
  return {
    workspace_root: execution.workspace_root,
    mutation_mode: mutationMode,
    allowed_paths: [...new Set(allowedPaths)],
    command,
    verification: verification.map((entry, index) =>
      normalizeCommand(entry, `verification[${index}]`),
    ),
  };
}

export function validateTaskContract(contract) {
  if (
    !contract ||
    contract.schemaVersion !== taskContractSchemaVersion ||
    contract.record_type !== "task_contract"
  )
    throw new Error("invalid task contract schema");
  for (const field of ["goal", "stop_condition"]) {
    if (typeof contract[field] !== "string" || contract[field].trim() === "")
      throw new Error(`task contract requires ${field}`);
  }
  for (const field of ["context_used", "assumptions", "constraints", "verification"]) {
    if (
      !Array.isArray(contract[field]) ||
      contract[field].some((value) => typeof value !== "string")
    )
      throw new Error(`task contract requires string array: ${field}`);
  }
  if (!["low", "medium", "high"].includes(contract.risk))
    throw new Error(`Unsupported task contract risk: ${contract.risk}`);
  if (contract.priority !== undefined && !/^P[0-3]$/.test(contract.priority))
    throw new Error(`Unsupported task contract priority: ${contract.priority}`);
  if (contract.engineering_plan !== undefined && contract.engineering_plan !== null)
    validateEngineeringPlan(contract.engineering_plan);
  if (contract.skill_plan !== undefined && contract.skill_plan !== null) {
    if (typeof contract.skill_plan !== "object" || Array.isArray(contract.skill_plan))
      throw new Error("task contract skill_plan must be an object or null");
    validateSkillCompositionPlan(contract.skill_plan);
  }
  if (contract.skill_execution !== undefined && contract.skill_execution !== null)
    validateSkillExecutionReference(contract.skill_execution);
  if (contract.execution !== null && contract.execution !== undefined) {
    const normalized = normalizeExecution(contract.execution);
    Object.assign(contract, { execution: normalized });
  }
  return contract;
}

export async function writeTaskContract(id, contract) {
  const contractId = safeContractId(id);
  const validated = validateTaskContract(contract);
  await ensureDir(getTaskContractRoot());
  const contractPath = path.join(getTaskContractRoot(), `${contractId}.json`);
  await writeJson(contractPath, validated);
  return contractPath;
}

export async function loadTaskContract(id) {
  return validateTaskContract(
    await readJson(path.join(getTaskContractRoot(), `${safeContractId(id)}.json`)),
  );
}
