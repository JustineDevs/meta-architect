import path from "node:path";
import { ensureDir, readJson, writeJson } from "../fs-utils.js";
import { getRuntimeSubsystemPath } from "../paths.js";

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
}) {
  if (!goal || !stopCondition) throw new Error("task contract requires goal and stopCondition");
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
    created_at: new Date().toISOString(),
  });
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
