import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  findOutdatedSchemas,
  migrateSchemas,
  runtimeSchemaVersion,
} from "../src/runtime/schema-migrations.js";
import { createTestNamespace } from "../src/test-fixtures.js";

test("schema migration is dry-run safe, backed up, idempotent, and reversible", async () => {
  const root = await createTestNamespace("schema-migrations");
  const file = path.join(root, ".ma", "context", "old.json");
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify({ schemaVersion: "0.0.1", value: "human" }));

  const dryRun = await migrateSchemas(root, { dryRun: true });
  assert.equal(dryRun.status, "outdated");
  assert.equal(JSON.parse(await fs.readFile(file, "utf8")).schemaVersion, "0.0.1");

  const migrated = await migrateSchemas(root);
  assert.equal(migrated.status, "migrated");
  assert.equal(JSON.parse(await fs.readFile(file, "utf8")).schemaVersion, runtimeSchemaVersion);
  assert.equal((await findOutdatedSchemas(root)).length, 0);
  assert.equal((await migrateSchemas(root)).status, "current");

  const rolledBack = await migrateSchemas(root, { rollback: true });
  assert.equal(rolledBack.status, "rolled_back");
  assert.equal(JSON.parse(await fs.readFile(file, "utf8")).schemaVersion, "0.0.1");
  await fs.rm(root, { recursive: true, force: true });
});

test("migration preflight fails without partially writing malformed state", async () => {
  const root = await createTestNamespace("schema-migrations-invalid");
  const valid = path.join(root, ".ma", "context", "valid.json");
  const invalid = path.join(root, ".ma", "context", "invalid.json");
  await fs.mkdir(path.dirname(valid), { recursive: true });
  await fs.writeFile(valid, JSON.stringify({ schemaVersion: "0.0.1" }));
  await fs.writeFile(invalid, "{broken");

  const result = await migrateSchemas(root);
  assert.equal(result.status, "failed");
  assert.equal(JSON.parse(await fs.readFile(valid, "utf8")).schemaVersion, "0.0.1");
  await fs.rm(root, { recursive: true, force: true });
});
