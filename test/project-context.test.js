import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { resolveContextConflict } from "../src/runtime/context-authority.js";
import {
  createContextQuality,
  deduplicateCanonicalFacts,
  loadProjectIndex,
  refreshProjectIndex,
  validateProjectIndex,
} from "../src/runtime/project-context.js";
import { createTestNamespace, removeTestNamespace } from "../src/test-fixtures.js";

test("project context builds a privacy-safe fingerprint and preserves overrides", async (t) => {
  const root = createTestNamespace("project-context");
  t.after(() => removeTestNamespace(root));
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.writeFile(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "context-fixture",
      scripts: { test: "API_TOKEN=secret node --test" },
      dependencies: { next: "1.0.0", zod: "1.0.0" },
    }),
  );
  await fs.writeFile(path.join(root, "package-lock.json"), "{}");
  await fs.writeFile(path.join(root, "src", "index.ts"), "export const ok = true;\n");
  await fs.writeFile(path.join(root, ".env.test"), "SECRET_KEY=do-not-index\n");
  await fs.mkdir(path.join(root, "node_modules"), { recursive: true });
  await fs.writeFile(path.join(root, "node_modules", "ignored.js"), "ignored");

  const first = await refreshProjectIndex(root);
  validateProjectIndex(first);
  assert.equal(first.quality.completeness, "complete");
  assert.equal(first.quality.confidence, "verified");
  assert.ok(first.facts.length >= 1);
  assert.match(first.facts[0].id, /^fact-[a-f0-9]{16}$/);
  assert.equal(first.facts[0].authority, "source_truth");
  assert.deepEqual(first.facts.find((fact) => fact.key === "commands").provenance, {
    type: "command",
    paths: ["package.json", "package-lock.json"],
    checkedAt: first.freshness.checkedAt,
  });
  assert.equal(first.context.authority, "source_truth");
  assert.equal(first.freshness.stale, false);
  assert.deepEqual(first.languages, ["typescript"]);
  assert.deepEqual(first.frameworks, ["next"]);
  assert.equal(first.packageManager, "npm");
  assert.equal(first.commands.test.includes("secret"), false);
  assert.equal(first.commands.test.includes("[REDACTED]"), true);
  assert.equal(
    first.sourceFiles.some((file) => file.path.includes(".env")),
    false,
  );
  assert.equal(
    first.sourceFiles.some((file) => file.path.startsWith("node_modules/")),
    false,
  );

  const indexPath = path.join(root, ".ma", "context", "project-index.json");
  const commands = JSON.parse(
    await fs.readFile(path.join(root, ".ma", "context", "commands.json"), "utf8"),
  );
  assert.deepEqual(commands.commands, first.commands);
  assert.match(
    await fs.readFile(path.join(root, ".ma", "context", "agent-brief.md"), "utf8"),
    /First-read/,
  );
  await fs.access(path.join(root, ".ma", "context", "architecture.md"));
  const edited = JSON.parse(await fs.readFile(indexPath, "utf8"));
  edited.humanOverrides = { knownGaps: ["manual review"], owner: "team-a" };
  await fs.writeFile(indexPath, `${JSON.stringify(edited, null, 2)}\n`);
  await fs.writeFile(path.join(root, "src", "new.ts"), "export const added = true;\n");
  const second = await refreshProjectIndex(root);
  assert.deepEqual(second.humanOverrides, edited.humanOverrides);
  assert.equal(second.freshness.changedFiles.includes("src/new.ts"), true);
  assert.deepEqual(
    second.facts.map((fact) => fact.id),
    first.facts.map((fact) => fact.id),
  );
  assert.deepEqual(await loadProjectIndex(root), second);

  edited.humanOverrides.corrections = { project: { name: "human-project-name" } };
  await fs.writeFile(indexPath, `${JSON.stringify(edited, null, 2)}\n`);
  const conflicted = await refreshProjectIndex(root);
  assert.equal(conflicted.humanOverrides.corrections.project.name, "human-project-name");
  assert.equal(conflicted.quality.confidence, "conflicting");
  assert.deepEqual(conflicted.quality.conflicts, ["project.name"]);

  const legacy = { ...second };
  delete legacy.facts;
  await fs.writeFile(indexPath, `${JSON.stringify(legacy, null, 2)}\n`);
  const migrated = await loadProjectIndex(root);
  assert.deepEqual(
    migrated.facts.map((fact) => fact.id),
    second.facts.map((fact) => fact.id),
  );
  assert.deepEqual(JSON.parse(await fs.readFile(indexPath, "utf8")).facts, migrated.facts);
});

test("context authority resolves current source over stale memory and vault notes", () => {
  const winner = resolveContextConflict([
    { authority: "learning_memory", freshness: { stale: false }, value: "old decision" },
    { authority: "vault_note", freshness: { stale: true }, value: "older note" },
    { authority: "source_truth", freshness: { stale: false }, value: "current source" },
  ]);
  assert.equal(winner.value, "current source");
});

test("context quality distinguishes complete, partial, minimal, stale, and inferred states", () => {
  assert.equal(
    createContextQuality({ sourceFiles: [{ path: "src/index.ts" }] }).completeness,
    "complete",
  );
  assert.equal(
    createContextQuality({ sourceFiles: [{ path: "src/index.ts" }], incompleteScan: true })
      .confidence,
    "inferred",
  );
  assert.equal(createContextQuality({ sourceFiles: [] }).completeness, "minimal");
  assert.equal(
    createContextQuality({ sourceFiles: [{ path: "src/index.ts" }], freshness: { stale: true } })
      .confidence,
    "stale",
  );
  assert.throws(
    () =>
      validateProjectIndex({
        quality: {
          completeness: "complete",
          confidence: "conflicting",
          coverage: {},
          verification: [],
          gaps: [],
        },
      }),
    /project index must be an object|schemaVersion/,
  );
});

test("canonical fact IDs deduplicate repeated projections and preserve stable anchors", () => {
  const facts = [
    { id: "fact-a", kind: "project", key: "name", value: "demo" },
    { id: "fact-a", kind: "project", key: "name", value: "demo" },
    { kind: "project", key: "stack", value: ["typescript"] },
    { kind: "project", key: "stack", value: ["typescript"] },
  ];
  assert.equal(deduplicateCanonicalFacts(facts).length, 2);
});

test("project context preserves monorepo and nested repository boundaries", async (t) => {
  const root = createTestNamespace("project-monorepo");
  t.after(() => removeTestNamespace(root));
  await fs.mkdir(path.join(root, "packages", "app", ".git"), { recursive: true });
  await fs.mkdir(path.join(root, "packages", "app", "src"), { recursive: true });
  await fs.writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ name: "workspace-root", workspaces: ["packages/*"] }),
  );
  await fs.writeFile(
    path.join(root, "packages", "app", "package.json"),
    JSON.stringify({ name: "app", scripts: { test: "node --test" } }),
  );
  await fs.writeFile(path.join(root, "packages", "app", "src", "index.ts"), "export {}\n");

  const index = await refreshProjectIndex(root);
  assert.equal(index.workspaces.declared, true);
  assert.deepEqual(index.workspaces.packages[0], {
    path: "packages/app",
    name: "app",
    commands: { test: "node --test" },
  });
  assert.deepEqual(index.nestedRepositories, ["packages/app"]);
});

test("project context identifies pnpm and yarn workspace lock boundaries", async (t) => {
  for (const [lockfile, manager] of [
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
  ]) {
    const root = createTestNamespace(`project-${manager}`);
    t.after(() => removeTestNamespace(root));
    await fs.writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ workspaces: ["packages/*"] }),
    );
    await fs.writeFile(path.join(root, lockfile), "");
    await fs.mkdir(path.join(root, "packages", "app"), { recursive: true });
    await fs.writeFile(
      path.join(root, "packages", "app", "package.json"),
      JSON.stringify({ name: "app" }),
    );
    const index = await refreshProjectIndex(root);
    assert.equal(index.packageManager, manager);
    assert.deepEqual(index.workspaces.packages[0].path, "packages/app");
  }
});

test("context refresh records incremental changes and full-refresh fallback", async (t) => {
  const root = createTestNamespace("project-refresh");
  t.after(() => removeTestNamespace(root));
  await fs.writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ scripts: { test: "node --test" } }),
  );
  await fs.writeFile(path.join(root, "README.md"), "# test\n");
  await refreshProjectIndex(root);
  await fs.writeFile(path.join(root, "README.md"), "# changed\n");
  const incremental = await refreshProjectIndex(root);
  assert.deepEqual(incremental.freshness.changedFiles, ["README.md"]);
  const receipt = JSON.parse(
    await fs.readFile(path.join(root, ".ma/context/refresh-receipt.json"), "utf8"),
  );
  assert.equal(receipt.mode, "incremental");
  assert.ok(receipt.affectedArtifacts.includes("architecture.md"));
  const full = await refreshProjectIndex(root, { mode: "full" });
  assert.equal(full.freshness.status, "unchanged");
  assert.equal(
    JSON.parse(await fs.readFile(path.join(root, ".ma/context/refresh-receipt.json"), "utf8")).mode,
    "full",
  );
});

test("project context falls back safely without package metadata or build commands", async (t) => {
  const root = createTestNamespace("project-context-fallback");
  t.after(() => removeTestNamespace(root));
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.writeFile(path.join(root, "src", "main.py"), "print('ok')\n");

  const index = await refreshProjectIndex(root);
  validateProjectIndex(index);
  assert.equal(index.project.name, path.basename(root));
  assert.deepEqual(index.languages, ["python"]);
  assert.deepEqual(index.frameworks, []);
  assert.equal(index.packageManager, null);
  assert.deepEqual(index.commands, {});
  assert.deepEqual(index.quality.gaps, []);
});

test("repository policy keeps local .ma runtime state ignored", async () => {
  const ignore = await fs.readFile(new URL("../.gitignore", import.meta.url), "utf8");
  assert.match(ignore, /^\.ma\/$/m);
  assert.match(
    await fs.readFile(new URL("../docs/project-context.md", import.meta.url), "utf8"),
    /Source-control policy/,
  );
});
