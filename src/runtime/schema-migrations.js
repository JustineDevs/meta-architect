import fs from "node:fs/promises";
import path from "node:path";
import { readJson, writeJson } from "../fs-utils.js";

export const runtimeSchemaVersion = "0.1.0";

const SCAN_ROOTS = [".ma/context", ".ma/learning", ".ma/hooks/receipts", ".ma/obsidian", "mcp"];
const ROOT_FILES = [".ma/setup-receipt.json"];

async function listJsonFiles(root, relative = "") {
  const directory = path.join(root, relative);
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...(await listJsonFiles(root, child)));
    else if (entry.isFile() && entry.name.endsWith(".json")) files.push(child);
  }
  return files;
}

async function migrationFiles(root) {
  const nested = (
    await Promise.all(SCAN_ROOTS.map((relative) => listJsonFiles(root, relative)))
  ).flat();
  return [...new Set([...nested, ...ROOT_FILES])].filter(async (relative) => {
    try {
      return (await fs.stat(path.join(root, relative))).isFile();
    } catch {
      return false;
    }
  });
}

// Promise.filter is intentionally avoided: this keeps the scan synchronous in its final form.
async function existingMigrationFiles(root) {
  const files = await migrationFiles(root);
  return (
    await Promise.all(
      files.map(async (relative) => {
        try {
          return (await fs.stat(path.join(root, relative))).isFile() ? relative : null;
        } catch {
          return null;
        }
      }),
    )
  ).filter(Boolean);
}

export async function findOutdatedSchemas(root) {
  const outdated = [];
  for (const relative of await existingMigrationFiles(root)) {
    try {
      const value = await readJson(path.join(root, relative));
      if (!value || Array.isArray(value) || typeof value !== "object") {
        outdated.push({ path: relative, schemaVersion: null, error: "invalid_shape" });
      } else if (value.schemaVersion !== runtimeSchemaVersion) {
        outdated.push({
          path: relative,
          schemaVersion: value.schemaVersion ?? null,
          expected: runtimeSchemaVersion,
        });
      }
    } catch {
      outdated.push({ path: relative, schemaVersion: null, error: "invalid_json" });
    }
  }
  return outdated;
}

export async function migrateSchemas(root, { dryRun = false, rollback = false } = {}) {
  const files = await existingMigrationFiles(root);
  if (rollback) return rollbackSchemas(root);

  const plans = [];
  for (const relative of files) {
    try {
      const value = await readJson(path.join(root, relative));
      if (!value || Array.isArray(value) || typeof value !== "object") {
        return {
          status: "failed",
          migrated: [],
          errors: [{ path: relative, error: "invalid_shape" }],
        };
      }
      if (value.schemaVersion !== runtimeSchemaVersion) {
        plans.push({ relative, value, from: value.schemaVersion ?? null });
      }
    } catch {
      return {
        status: "failed",
        migrated: [],
        errors: [{ path: relative, error: "invalid_json" }],
      };
    }
  }
  if (dryRun)
    return {
      status: plans.length ? "outdated" : "current",
      dryRun: true,
      migrated: plans.map(({ relative, from }) => ({
        path: relative,
        from,
        to: runtimeSchemaVersion,
      })),
      errors: [],
    };
  if (plans.length === 0) return { status: "current", migrated: [], errors: [] };

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupRoot = path.join(root, ".ma", "migrations", "backups", stamp);
  for (const { relative, value } of plans) {
    const target = path.join(root, relative);
    const backup = path.join(backupRoot, relative);
    await fs.mkdir(path.dirname(backup), { recursive: true });
    await fs.copyFile(target, backup);
    await writeJson(target, { ...value, schemaVersion: runtimeSchemaVersion });
  }
  await writeJson(path.join(root, ".ma", "migrations", "latest.json"), {
    schemaVersion: runtimeSchemaVersion,
    createdAt: new Date().toISOString(),
    backupRoot: path.relative(root, backupRoot),
    files: plans.map(({ relative }) => relative),
  });
  return {
    status: "migrated",
    backupRoot: path.relative(root, backupRoot),
    migrated: plans.map(({ relative, from }) => ({
      path: relative,
      from,
      to: runtimeSchemaVersion,
    })),
    errors: [],
  };
}

async function rollbackSchemas(root) {
  let receipt;
  try {
    receipt = await readJson(path.join(root, ".ma", "migrations", "latest.json"));
  } catch {
    return { status: "current", restored: [], errors: [] };
  }
  const restored = [];
  for (const relative of receipt.files ?? []) {
    const source = path.join(root, receipt.backupRoot, relative);
    const target = path.join(root, relative);
    try {
      await fs.copyFile(source, target);
      restored.push(relative);
    } catch {
      return { status: "failed", restored, errors: [{ path: relative, error: "backup_missing" }] };
    }
  }
  return { status: "rolled_back", restored, errors: [] };
}
