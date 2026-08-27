import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import {
  clearPreference,
  getPreferencesPath,
  resolvePreferences,
  seedPreferences,
  setPreference,
} from "../src/runtime/preferences.js";
import { createTestNamespace } from "../src/test-fixtures.js";

test("preferences persist with explicit scopes and precedence", async (t) => {
  const root = createTestNamespace("ma-preferences");
  const previousRoot = process.env.MA_ROOT;
  process.env.MA_ROOT = root;
  t.after(async () => {
    if (previousRoot === undefined) delete process.env.MA_ROOT;
    else process.env.MA_ROOT = previousRoot;
    await fs.rm(root, { recursive: true, force: true });
  });

  await seedPreferences();
  await setPreference("namespace", "user", { scope: "user-local" });
  await setPreference("namespace", "project", { scope: "project-shared" });
  await setPreference("namespace", "session", { scope: "session-only" });
  await setPreference("obsidian", "/home/user/vault", { scope: "user-local" });
  await setPreference("public-output", "API_TOKEN=secret", { scope: "project-shared" });

  const resolved = await resolvePreferences();
  assert.deepEqual(resolved.namespace, { value: "session", scope: "session-only" });
  assert.equal(resolved.obsidian.value, "__MA_PATH_REDACTED__");
  assert.match(resolved["public-output"].value, /^__MA_SECURE_ASSIGNMENT__/);
  assert.match(await fs.readFile(getPreferencesPath(), "utf8"), /project-shared/);

  await clearPreference("namespace", { scope: "session-only" });
  assert.deepEqual((await resolvePreferences()).namespace, {
    value: "project",
    scope: "project-shared",
  });
  await clearPreference("namespace");
  assert.equal((await resolvePreferences()).namespace, undefined);
});

test("preferences are exposed through context MCP", async (t) => {
  const root = createTestNamespace("ma-preferences-mcp");
  const previousRoot = process.env.MA_ROOT;
  process.env.MA_ROOT = root;
  t.after(async () => {
    if (previousRoot === undefined) delete process.env.MA_ROOT;
    else process.env.MA_ROOT = previousRoot;
    await fs.rm(root, { recursive: true, force: true });
  });
  await seedPreferences();
  await setPreference("namespace", ".ma", { scope: "project-shared" });
  const { readContextResource } = await import("../mcp/local/context.js");
  const result = await readContextResource("context://preferences");
  assert.equal(result.data.namespace.value, ".ma");
  assert.equal(result.context.authority, "learning_memory");
});
