import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  createDefaultObsidianBridge,
  createDefaultObsidianVaultOperations,
  createObsidianIntakeContext,
  createObsidianNote,
  createObsidianPluginRequest,
  createObsidianVaultContext,
  createObsidianVaultSnapshotExport,
  deleteObsidianNote,
  embedProjectContext,
  ensureObsidianGraphLinks,
  indexObsidianVault,
  listObsidianNotes,
  readObsidianNote,
  updateObsidianNote,
  validateObsidianBridge,
  validateObsidianVaultOperations,
  writeObsidianVaultIndex,
} from "../src/runtime/obsidian-integration-core.js";
import { createTestNamespace } from "../src/test-fixtures.js";

test("Obsidian bridge preserves vault context authority boundaries", () => {
  const bridge = validateObsidianBridge(createDefaultObsidianBridge());

  assert.equal(bridge.semantic_boundary.records_as, "vault_context");
  assert.equal(bridge.semantic_boundary.never_records_as, "build_evidence");
  assert.equal(
    bridge.compatibility_references.sample_plugin_structure,
    "https://github.com/obsidianmd/obsidian-sample-plugin",
  );
  assert.equal(
    bridge.plugin_contract.authoritative_changes_return_through,
    "$maestro_or_owning_lane",
  );
  assert.equal(bridge.graph_link_policy.enabled_by_default, true);
  assert.equal(bridge.graph_link_policy.semantic_symlink_type, "obsidian_wikilink");
  assert.equal(bridge.graph_link_policy.map_note_path, "Meta-Architect/Map of Content.md");
  assert.equal(bridge.plugin_contract.must_not_mutate.includes(".ma/release.json"), true);
  assert.equal(bridge.plugin_contract.must_not_mutate.includes(".ma/decisions.json"), true);
});

test("Obsidian requests and tag-graph claims remain vault_context", () => {
  const request = createObsidianPluginRequest({
    action: "select-notes",
    notePaths: ["Architecture/ADR-001.md"],
    tags: ["ma/architecture"],
  });
  const context = createObsidianVaultContext({
    notePath: "Architecture/ADR-001.md",
    title: "ADR-001",
    tags: ["ma/architecture"],
    claims: [{ text: "Operator prefers architecture-first planning." }],
  });

  assert.equal(request.records_as, "vault_context");
  assert.equal(request.authoritative_change, false);
  assert.equal(context.record_type, "vault_context");
  assert.equal(context.claims[0].records_as, "vault_context");
  assert.equal(context.claims[0].build_evidence, false);
});

test("Obsidian snapshot export and intake records are read-only vault_context", () => {
  const snapshot = createObsidianVaultSnapshotExport({
    artifactPath: ".ma/plans/build.md",
    vaultPath: "/vault",
    notePath: "Meta-Architect/Build.md",
    tags: ["ma/build"],
    provenance: [".ma/plans/build.md"],
  });
  const intake = createObsidianIntakeContext({
    allowedNotes: [
      {
        notePath: "Meta-Architect/Brain.md",
        claims: [{ text: "Prefer architecture-first." }],
      },
    ],
    tagGraph: [{ tag: "ma/build", linked: ["ma/architecture"] }],
  });

  assert.equal(snapshot.record_type, "obsidian_vault_snapshot_export");
  assert.equal(snapshot.records_as, "vault_context");
  assert.equal(snapshot.build_evidence, false);
  assert.equal(snapshot.read_only_snapshot, true);
  assert.equal(intake.record_type, "obsidian_intake_context");
  assert.equal(intake.allowed_notes[0].claims[0].build_evidence, false);
  assert.equal(intake.requires_operator_allowlist, true);
});

test("Obsidian vault index crawls real markdown notes as vault_context", async () => {
  const vaultRoot = createTestNamespace("ma-obsidian-vault");
  await fs.mkdir(path.join(vaultRoot, ".obsidian"));
  await fs.mkdir(path.join(vaultRoot, "Architecture"), { recursive: true });
  await fs.writeFile(path.join(vaultRoot, ".obsidian", "workspace.json"), "{}\n");
  await fs.writeFile(
    path.join(vaultRoot, "Architecture", "ADR-001.md"),
    `---
tags: [ma/architecture, project/brain]
---
# ADR-001

Use architecture-first planning. Link to [[Execution Plan]] and #ma/review.
`,
  );
  await fs.writeFile(
    path.join(vaultRoot, "Execution Plan.md"),
    `# Execution Plan

Build in small slices. See [[Architecture/ADR-001|the ADR]].
`,
  );

  const index = await indexObsidianVault({ vaultPath: vaultRoot });

  assert.equal(index.record_type, "obsidian_vault_index");
  assert.equal(index.records_as, "vault_context");
  assert.equal(index.build_evidence, false);
  assert.equal(index.read_only_snapshot, true);
  assert.equal(index.note_count, 2);
  assert.equal(
    index.notes.some((note) => note.relative_path === "Architecture/ADR-001.md"),
    true,
  );
  assert.equal(
    index.notes.some((note) => note.relative_path.includes(".obsidian")),
    false,
  );
  assert.equal(
    index.tags.some((entry) => entry.tag === "ma/architecture"),
    true,
  );
  assert.equal(
    index.tags.some((entry) => entry.tag === "ma/review"),
    true,
  );
  assert.equal(
    index.notes.every(
      (note) =>
        note.records_as === "vault_context" &&
        note.build_evidence === false &&
        /^[a-f0-9]{64}$/.test(note.content_sha256),
    ),
    true,
  );
  assert.equal(
    index.tag_graph_claims.every(
      (claim) => claim.records_as === "vault_context" && claim.build_evidence === false,
    ),
    true,
  );
});

test("Obsidian project context embeds into the MA graph namespace", async (t) => {
  const vaultRoot = createTestNamespace("ma-obsidian-project-context");
  const runtimeRoot = createTestNamespace("ma-obsidian-project-runtime");
  t.after(async () => {
    await fs.rm(vaultRoot, { recursive: true, force: true });
    await fs.rm(runtimeRoot, { recursive: true, force: true });
  });
  process.env.MA_ROOT = runtimeRoot;
  try {
    await fs.mkdir(path.join(runtimeRoot, ".ma", "context"), { recursive: true });
    await fs.writeFile(
      path.join(runtimeRoot, ".ma", "context", "obsidian-vault-operations.json"),
      JSON.stringify(createDefaultObsidianVaultOperations(), null, 2),
    );
    const result = await embedProjectContext({
      vaultPath: vaultRoot,
      projectIndex: {
        project: { name: "demo-app" },
        authority: "source_truth",
        freshness: { status: "fresh" },
        quality: { coverage: { sourceFiles: 3 } },
        languages: ["typescript"],
        frameworks: ["nextjs"],
        packageManager: "pnpm",
        commands: { test: "pnpm test" },
        entrypoints: ["src/index.ts"],
        importantDocs: ["README.md"],
        vendorIntegrations: ["codex-cli"],
      },
    });
    const note = await fs.readFile(
      path.join(vaultRoot, "Meta-Architect", "Projects", "demo-app", "Project Context.md"),
      "utf8",
    );
    const map = await fs.readFile(
      path.join(vaultRoot, "Meta-Architect", "Map of Content.md"),
      "utf8",
    );
    assert.equal(result.notePath, "Meta-Architect/Projects/demo-app/Project Context.md");
    assert.match(note, /\[\[Meta-Architect\/Map of Content\|MA Map of Content\]\]/);
    assert.match(map, /\[\[Meta-Architect\/Projects\/demo-app\/Project Context\]\]/);
    assert.equal(result.index.records_as, "vault_context");
    assert.equal(result.index.build_evidence, false);
    const operations = JSON.parse(
      await fs.readFile(
        path.join(runtimeRoot, ".ma", "context", "obsidian-vault-operations.json"),
        "utf8",
      ),
    );
    assert.equal(
      operations.operations.some((entry) => entry.relative_path === result.notePath),
      true,
    );
  } finally {
    delete process.env.MA_ROOT;
  }
});

test("Obsidian vault CRUD creates, reads, updates, deletes real markdown notes safely", async () => {
  const vaultRoot = createTestNamespace("ma-obsidian-crud");
  const content = `# MA Core CRUD

This note proves Obsidian CRUD writes real non-empty vault context. #ma/crud
`;
  const updated = `${content}
Updated through MA core at test time.
`;

  const createReceipt = await createObsidianNote({
    vaultPath: vaultRoot,
    notePath: "Meta-Architect/Core CRUD",
    content,
  });
  const readCreated = await readObsidianNote({
    vaultPath: vaultRoot,
    notePath: "Meta-Architect/Core CRUD.md",
  });
  const updateReceipt = await updateObsidianNote({
    vaultPath: vaultRoot,
    notePath: "Meta-Architect/Core CRUD",
    content: updated,
  });
  const list = await listObsidianNotes({ vaultPath: vaultRoot });
  const indexed = await indexObsidianVault({ vaultPath: vaultRoot });
  const deleteReceipt = await deleteObsidianNote({
    vaultPath: vaultRoot,
    notePath: "Meta-Architect/Core CRUD",
  });
  const afterDelete = await listObsidianNotes({ vaultPath: vaultRoot });

  assert.equal(createReceipt.operation, "create_note");
  assert.equal(createReceipt.records_as, "vault_context");
  assert.equal(createReceipt.build_evidence, false);
  assert.equal(readCreated.content.includes("real non-empty vault context"), true);
  assert.equal(updateReceipt.operation, "update_note");
  assert.equal(list.notes.includes("Meta-Architect/Core CRUD.md"), true);
  assert.equal(indexed.note_count, 1);
  assert.equal(indexed.total_words > 0, true);
  assert.equal(deleteReceipt.operation, "delete_note");
  assert.equal(afterDelete.notes.length, 0);
});

test("Obsidian vault indexing auto-links MA notes through the canonical graph hub", async () => {
  const previousRoot = process.env.MA_ROOT;
  const tempRoot = createTestNamespace("ma-obsidian-graph-root");
  const vaultRoot = createTestNamespace("ma-obsidian-graph-vault");
  process.env.MA_ROOT = tempRoot;
  await fs.mkdir(path.join(vaultRoot, "Meta-Architect", "Stress Smokes"), { recursive: true });
  await fs.writeFile(
    path.join(vaultRoot, "Meta-Architect", "Core Brain Context.md"),
    `# Meta-Architect Core Brain Context

Obsidian records as vault_context, not build_evidence. #ma/core
`,
  );
  await fs.writeFile(
    path.join(vaultRoot, "Meta-Architect", "Stress Smokes", "External Workspace.md"),
    `# External Workspace Stress Smoke

Real stress context. #ma/stress-smoke
`,
  );

  try {
    const graph = await ensureObsidianGraphLinks({ vaultPath: vaultRoot });
    const index = await writeObsidianVaultIndex({ vaultPath: vaultRoot });
    const map = await readObsidianNote({
      vaultPath: vaultRoot,
      notePath: "Meta-Architect/Map of Content.md",
    });
    const core = await readObsidianNote({
      vaultPath: vaultRoot,
      notePath: "Meta-Architect/Core Brain Context.md",
    });
    const smoke = await readObsidianNote({
      vaultPath: vaultRoot,
      notePath: "Meta-Architect/Stress Smokes/External Workspace.md",
    });

    assert.equal(graph.semantic_symlink_type, "obsidian_wikilink");
    assert.equal(index.note_count, 3);
    assert.deepEqual(index.unresolved_links, []);
    assert.match(map.content, /\[\[Meta-Architect\/Core Brain Context\]\]/);
    assert.match(map.content, /\[\[Meta-Architect\/Stress Smokes\/External Workspace\]\]/);
    assert.match(core.content, /\[\[Meta-Architect\/Map of Content\|MA Map of Content\]\]/);
    assert.match(smoke.content, /\[\[Meta-Architect\/Map of Content\|MA Map of Content\]\]/);
    assert.match(smoke.content, /\[\[Meta-Architect\/Core Brain Context\|Core Brain Context\]\]/);
  } finally {
    if (previousRoot === undefined) {
      delete process.env.MA_ROOT;
    } else {
      process.env.MA_ROOT = previousRoot;
    }
  }
});

test("Obsidian operation log validates lane-owned CRUD receipts", () => {
  const log = validateObsidianVaultOperations({
    ...createDefaultObsidianVaultOperations(),
    operations: [
      {
        record_type: "obsidian_vault_operation",
        operation: "create_note",
        records_as: "vault_context",
        build_evidence: false,
        authority_boundary: "$maestro_or_owning_lane",
        vault_path: "/vault",
        relative_path: "Meta-Architect/Core.md",
        content_sha256: "a".repeat(64),
        char_count: 10,
        word_count: 2,
        operated_at: new Date().toISOString(),
      },
    ],
  });

  assert.equal(log.operations.length, 1);
});

test("Obsidian CRUD rejects traversal and vault control directories", async () => {
  const vaultRoot = createTestNamespace("ma-obsidian-safe");

  await assert.rejects(
    () =>
      createObsidianNote({
        vaultPath: vaultRoot,
        notePath: "../outside",
        content: "Nope.",
      }),
    /inside the vault/,
  );
  await assert.rejects(
    () =>
      createObsidianNote({
        vaultPath: vaultRoot,
        notePath: ".obsidian/workspace",
        content: "Nope.",
      }),
    /control directories/,
  );
  await assert.rejects(
    () =>
      createObsidianNote({
        vaultPath: vaultRoot,
        notePath: "./.obsidian/workspace",
        content: "Nope.",
      }),
    /control directories/,
  );
});

test("Obsidian CRUD rejects symlink escapes", async () => {
  if (process.platform === "win32") return;
  const vaultRoot = createTestNamespace("ma-obsidian-symlink-vault");
  const outsideRoot = createTestNamespace("ma-obsidian-symlink-outside");
  const outsideNote = path.join(outsideRoot, "secret.md");
  await fs.writeFile(outsideNote, "secret", "utf8");
  await fs.symlink(outsideNote, path.join(vaultRoot, "Escaped.md"));

  await assert.rejects(
    () => readObsidianNote({ vaultPath: vaultRoot, notePath: "Escaped.md" }),
    /symlink/,
  );
  await assert.rejects(
    () =>
      updateObsidianNote({ vaultPath: vaultRoot, notePath: "Escaped.md", content: "overwrite" }),
    /symlink/,
  );
  assert.equal(await fs.readFile(outsideNote, "utf8"), "secret");
});

test("Obsidian CRUD rejects dangling symlink components", async () => {
  if (process.platform === "win32") return;
  const vaultRoot = createTestNamespace("ma-obsidian-dangling-vault");
  await fs.symlink("/definitely-missing-target", path.join(vaultRoot, "Escape"));

  await assert.rejects(
    () =>
      createObsidianNote({
        vaultPath: vaultRoot,
        notePath: "Escape/new-note",
        content: "Nope.",
      }),
    /symlink/,
  );
});
