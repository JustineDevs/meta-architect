import { ensureDir, readJson, writeFileIfMissing, writeJson } from "../fs-utils.js";
import { getRuntimeSubsystemPath } from "../paths.js";

export const headroomSchemaVersion = "0.1.0";

const defaultBudgets = {
  pendingMailboxCount: { warn: 3, critical: 8 },
  taskCount: { warn: 10, critical: 25 },
  activeManagerRunCount: { warn: 2, critical: 5 },
  waitingReviewManagerRunCount: { warn: 1, critical: 3 },
};

export function getHeadroomRoot() {
  return getRuntimeSubsystemPath("headroom");
}

export function getHeadroomBudgetsPath() {
  return getRuntimeSubsystemPath("headroom", "budgets.json");
}

export function getHeadroomStatusPath() {
  return getRuntimeSubsystemPath("headroom", "status.json");
}

export function createDefaultHeadroomBudgets() {
  return { schemaVersion: headroomSchemaVersion, budgets: structuredClone(defaultBudgets) };
}

export function createDefaultHeadroomStatus() {
  return { schemaVersion: headroomSchemaVersion, evaluatedAt: null, signals: [] };
}

export function validateHeadroomBudgets(value) {
  if (!value || typeof value !== "object" || value.schemaVersion !== headroomSchemaVersion) {
    throw new Error("headroom budgets require the current schemaVersion");
  }
  if (!value.budgets || typeof value.budgets !== "object" || Array.isArray(value.budgets)) {
    throw new Error("headroom budgets require a budgets object");
  }
  for (const [counter, budget] of Object.entries(value.budgets)) {
    if (
      !budget ||
      !Number.isFinite(budget.warn) ||
      !Number.isFinite(budget.critical) ||
      budget.warn < 0 ||
      budget.critical < budget.warn
    ) {
      throw new Error(`Invalid headroom budget for ${counter}`);
    }
  }
  return value;
}

export function validateHeadroomStatus(value) {
  if (!value || typeof value !== "object" || value.schemaVersion !== headroomSchemaVersion) {
    throw new Error("headroom status requires the current schemaVersion");
  }
  if (!Array.isArray(value.signals)) throw new Error("headroom status requires signals");
  return value;
}

export async function seedHeadroomArtifacts() {
  await ensureDir(getHeadroomRoot());
  await writeFileIfMissing(
    getHeadroomBudgetsPath(),
    `${JSON.stringify(createDefaultHeadroomBudgets(), null, 2)}\n`,
  );
  await writeFileIfMissing(
    getHeadroomStatusPath(),
    `${JSON.stringify(createDefaultHeadroomStatus(), null, 2)}\n`,
  );
}

export async function loadHeadroomBudgets() {
  return validateHeadroomBudgets(await readJson(getHeadroomBudgetsPath()));
}

export async function loadHeadroomStatus() {
  return validateHeadroomStatus(await readJson(getHeadroomStatusPath()));
}

export function evaluateHeadroom(
  runtimeSummary = {},
  budgetConfig = createDefaultHeadroomBudgets(),
) {
  const config = validateHeadroomBudgets(budgetConfig);
  const signals = Object.entries(config.budgets).map(([counter, budget]) => {
    const value = Number(runtimeSummary[counter] ?? 0);
    const level = value >= budget.critical ? "critical" : value >= budget.warn ? "warn" : "ok";
    return { counter, value, warn: budget.warn, critical: budget.critical, level };
  });
  return {
    schemaVersion: headroomSchemaVersion,
    evaluatedAt: new Date().toISOString(),
    signals,
  };
}

export async function writeHeadroomStatus(runtimeSummary, budgetConfig) {
  const status = validateHeadroomStatus(evaluateHeadroom(runtimeSummary, budgetConfig));
  await ensureDir(getHeadroomRoot());
  await writeJson(getHeadroomStatusPath(), status);
  return status;
}
