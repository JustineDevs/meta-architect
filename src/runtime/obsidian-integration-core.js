import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { ensureDir, readJson, writeFileIfMissing, writeJson } from "../fs-utils.js";
import { getRuntimeSubsystemPath } from "../paths.js";
import { createDefaultObsidianPluginBridgeManifest } from "./obsidian-plugin-bridge.js";

export const obsidianIntegrationSchemaVersion = "0.1.0";
export const obsidianGraphMapNotePath = "Meta-Architect/Map of Content.md";
const obsidianGraphSectionHeading = "## Obsidian Graph Links";

export function getObsidianBridgePath() {
  return getRuntimeSubsystemPath("context", "obsidian-bridge.json");
}

export function getObsidianVaultIndexPath() {
  return getRuntimeSubsystemPath("context", "obsidian-vault-index.json");
}

export function getObsidianVaultOperationsPath() {
  return getRuntimeSubsystemPath("context", "obsidian-vault-operations.json");
}

export function createDefaultObsidianBridge() {
  return {
    schemaVersion: obsidianIntegrationSchemaVersion,
    product: "Meta-Architect",
    purpose:
      "Defines the default MA-owned Obsidian bridge for vault context, plugin requests, and note-selection metadata.",
    compatibility_references: {
      api_docs: "https://gitmcp.io/obsidianmd/obsidian-api",
      sample_plugin_structure: "https://github.com/obsidianmd/obsidian-sample-plugin",
    },
    semantic_boundary: {
      semantic_role: "brain_context",
      records_as: "vault_context",
      never_records_as: "build_evidence",
    },
    graph_link_policy: {
      enabled_by_default: true,
      semantic_symlink_type: "obsidian_wikilink",
      map_note_path: obsidianGraphMapNotePath,
      every_ma_note_links_to_map: true,
      map_links_all_ma_notes: true,
      records_as: "vault_context",
      build_evidence: false,
    },
    plugin_contract: {
      may_queue_requests: true,
      may_expose_note_selection_metadata: true,
      allowed_vault_operations: [
        "create_note",
        "read_note",
        "update_note",
        "delete_note",
        "list_notes",
      ],
      must_not_mutate: [".ma/release.json", ".ma/decisions.json", ".ma/plans/", ".ma/specs/"],
      authoritative_changes_return_through: "$maestro_or_owning_lane",
    },
    plugin_runtime: createDefaultObsidianPluginBridgeManifest(),
    default_request_queue: [],
    note_selection_metadata: [],
    tag_graph_claims: [],
  };
}

export function createDefaultObsidianVaultIndex() {
  return {
    schemaVersion: obsidianIntegrationSchemaVersion,
    record_type: "obsidian_vault_index",
    records_as: "vault_context",
    build_evidence: false,
    read_only_snapshot: true,
    vault_path: null,
    indexed_at: null,
    note_count: 0,
    total_words: 0,
    total_chars: 0,
    tags: [],
    unresolved_links: [],
    notes: [],
    tag_graph_claims: [],
  };
}

export function createDefaultObsidianVaultOperations() {
  return {
    schemaVersion: obsidianIntegrationSchemaVersion,
    record_type: "obsidian_vault_operations",
    records_as: "vault_context",
    build_evidence: false,
    authority_boundary: "$maestro_or_owning_lane",
    operations: [],
  };
}

export function createObsidianPluginRequest({
  action,
  notePaths = [],
  tags = [],
  reason = "operator_selected_context",
}) {
  if (!action || typeof action !== "string") {
    throw new Error("Obsidian plugin request requires an action");
  }

  return {
    record_type: "obsidian_plugin_request",
    action,
    reason,
    records_as: "vault_context",
    authoritative_change: false,
    note_paths: notePaths.filter((entry) => typeof entry === "string" && entry.trim()),
    tags: tags.filter((entry) => typeof entry === "string" && entry.trim()),
    queued_at: new Date().toISOString(),
  };
}

export function createObsidianVaultContext({ notePath, title, tags = [], claims = [] }) {
  if (!notePath || typeof notePath !== "string") {
    throw new Error("Obsidian vault context requires notePath");
  }

  return {
    record_type: "vault_context",
    note_path: notePath,
    title: title || notePath,
    tags: tags.filter((entry) => typeof entry === "string" && entry.trim()),
    claims: claims.map((claim) => ({
      ...claim,
      records_as: "vault_context",
      build_evidence: false,
    })),
  };
}

export function createObsidianVaultSnapshotExport({
  artifactPath,
  vaultPath,
  notePath,
  title,
  tags = [],
  provenance = [],
}) {
  if (!artifactPath || !notePath) {
    throw new Error("Obsidian vault snapshot export requires artifactPath and notePath");
  }

  return {
    record_type: "obsidian_vault_snapshot_export",
    records_as: "vault_context",
    build_evidence: false,
    read_only_snapshot: true,
    artifact_path: artifactPath,
    vault_path: vaultPath ?? null,
    note_path: notePath,
    title: title || notePath,
    tags: tags.filter((entry) => typeof entry === "string" && entry.trim()),
    provenance: provenance.filter((entry) => typeof entry === "string" && entry.trim()),
    authoritative_change: false,
    authority_boundary: "$maestro_or_owning_lane",
  };
}

export function createObsidianIntakeContext({ allowedNotes = [], tagGraph = [] }) {
  const notes = allowedNotes.map((note) =>
    createObsidianVaultContext({
      notePath: note.notePath,
      title: note.title,
      tags: note.tags,
      claims: note.claims,
    }),
  );
  return {
    record_type: "obsidian_intake_context",
    records_as: "vault_context",
    build_evidence: false,
    allowed_notes: notes,
    tag_graph_claims: tagGraph.map((claim) => ({
      ...claim,
      records_as: "vault_context",
      build_evidence: false,
    })),
    requires_operator_allowlist: true,
    authoritative_change: false,
  };
}

export async function indexObsidianVault({ vaultPath, maxExcerptChars = 360 } = {}) {
  if (!vaultPath || typeof vaultPath !== "string") {
    throw new Error("Obsidian vault indexing requires vaultPath");
  }

  const resolvedVaultPath = path.resolve(vaultPath);
  const stat = await fs.stat(resolvedVaultPath);
  if (!stat.isDirectory()) {
    throw new Error(`Obsidian vault path is not a directory: ${resolvedVaultPath}`);
  }

  const notePaths = await listMarkdownNotes(resolvedVaultPath);
  const notes = [];
  const tagCounts = new Map();
  const linkTargets = new Map();
  let totalWords = 0;
  let totalChars = 0;

  for (const absolutePath of notePaths) {
    const content = await fs.readFile(absolutePath, "utf8");
    const relativePath = normalizeVaultPath(path.relative(resolvedVaultPath, absolutePath));
    const tags = extractObsidianTags(content);
    const links = extractObsidianLinks(content);
    const title = extractTitle(content) ?? path.basename(relativePath, ".md");
    const words = countWords(content);
    totalWords += words;
    totalChars += content.length;

    for (const tag of tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
    for (const link of links) {
      const targetKey = normalizeLinkKey(link.target);
      const refs = linkTargets.get(targetKey) ?? [];
      refs.push(relativePath);
      linkTargets.set(targetKey, refs);
    }

    notes.push({
      record_type: "vault_context_note",
      records_as: "vault_context",
      build_evidence: false,
      relative_path: relativePath,
      title,
      tags,
      links,
      word_count: words,
      char_count: content.length,
      content_sha256: createHash("sha256").update(content).digest("hex"),
      excerpt: createExcerpt(content, maxExcerptChars),
    });
  }

  const existingNoteKeys = new Set([
    ...notes.map((note) => normalizeLinkKey(note.title)),
    ...notes.map((note) => normalizeLinkKey(note.relative_path)),
    ...notes.map((note) => normalizeLinkKey(note.relative_path.replace(/\.md$/i, ""))),
  ]);
  const unresolvedLinks = [...linkTargets.entries()]
    .filter(([target]) => !existingNoteKeys.has(target))
    .map(([target, sources]) => ({
      target,
      sources: [...new Set(sources)].sort(),
      records_as: "vault_context",
      build_evidence: false,
    }))
    .sort((a, b) => a.target.localeCompare(b.target));
  const tags = [...tagCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  const tagGraphClaims = tags.map(({ tag, count }) => ({
    tag,
    claim: `Tag ${tag} appears in ${count} Obsidian note${count === 1 ? "" : "s"}.`,
    records_as: "vault_context",
    build_evidence: false,
  }));

  return validateObsidianVaultIndex({
    schemaVersion: obsidianIntegrationSchemaVersion,
    record_type: "obsidian_vault_index",
    records_as: "vault_context",
    build_evidence: false,
    read_only_snapshot: true,
    vault_path: resolvedVaultPath,
    indexed_at: new Date().toISOString(),
    note_count: notes.length,
    total_words: totalWords,
    total_chars: totalChars,
    tags,
    unresolved_links: unresolvedLinks,
    notes,
    tag_graph_claims: tagGraphClaims,
  });
}

export async function listObsidianNotes({ vaultPath } = {}) {
  const resolvedVaultPath = await resolveVaultRoot(vaultPath);
  const notePaths = await listMarkdownNotes(resolvedVaultPath);
  return {
    record_type: "obsidian_note_list",
    records_as: "vault_context",
    build_evidence: false,
    vault_path: resolvedVaultPath,
    notes: notePaths.map((absolutePath) =>
      normalizeVaultPath(path.relative(resolvedVaultPath, absolutePath)),
    ),
  };
}

export async function readObsidianNote({ vaultPath, notePath } = {}) {
  const target = await resolveVaultNotePath({ vaultPath, notePath, mustExist: true });
  const content = await fs.readFile(target.absolutePath, "utf8");
  const stat = await fs.stat(target.absolutePath);
  return {
    record_type: "obsidian_note_read",
    records_as: "vault_context",
    build_evidence: false,
    vault_path: target.vaultPath,
    relative_path: target.relativePath,
    title: extractTitle(content) ?? path.basename(target.relativePath, ".md"),
    content,
    content_sha256: createHash("sha256").update(content).digest("hex"),
    char_count: content.length,
    word_count: countWords(content),
    updated_at: stat.mtime.toISOString(),
  };
}

export async function createObsidianNote({ vaultPath, notePath, content, overwrite = false } = {}) {
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("Obsidian create requires non-empty note content");
  }
  const target = await resolveVaultNotePath({ vaultPath, notePath, mustExist: false });
  if (!overwrite && (await pathExists(target.absolutePath))) {
    throw new Error(`Obsidian note already exists: ${target.relativePath}`);
  }
  await fs.mkdir(path.dirname(target.absolutePath), { recursive: true });
  await fs.writeFile(target.absolutePath, content, "utf8");
  return createObsidianOperationReceipt({
    operation: overwrite ? "update_note" : "create_note",
    target,
    content,
  });
}

export async function updateObsidianNote({ vaultPath, notePath, content } = {}) {
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("Obsidian update requires non-empty note content");
  }
  const target = await resolveVaultNotePath({ vaultPath, notePath, mustExist: true });
  await fs.writeFile(target.absolutePath, content, "utf8");
  return createObsidianOperationReceipt({ operation: "update_note", target, content });
}

export async function deleteObsidianNote({ vaultPath, notePath } = {}) {
  const target = await resolveVaultNotePath({ vaultPath, notePath, mustExist: true });
  const content = await fs.readFile(target.absolutePath, "utf8");
  await fs.unlink(target.absolutePath);
  return createObsidianOperationReceipt({
    operation: "delete_note",
    target,
    content,
  });
}

export async function ensureObsidianGraphLinks({ vaultPath } = {}) {
  const resolvedVaultPath = await resolveVaultRoot(vaultPath);
  const notePaths = await listMarkdownNotes(resolvedVaultPath);
  const maNotePaths = notePaths
    .map((absolutePath) => normalizeVaultPath(path.relative(resolvedVaultPath, absolutePath)))
    .filter((relativePath) => relativePath.startsWith("Meta-Architect/"));
  const mapPath = obsidianGraphMapNotePath;
  const nonMapMaNotes = maNotePaths.filter((relativePath) => relativePath !== mapPath).sort();
  const receipts = [];

  const mapContent = createObsidianGraphMapContent(nonMapMaNotes);
  const mapReceipt = await upsertObsidianNoteContent({
    vaultPath: resolvedVaultPath,
    notePath: mapPath,
    content: mapContent,
  });
  if (mapReceipt) receipts.push(mapReceipt);

  const refreshedNotePaths = await listMarkdownNotes(resolvedVaultPath);
  const refreshedMaNotes = refreshedNotePaths
    .map((absolutePath) => normalizeVaultPath(path.relative(resolvedVaultPath, absolutePath)))
    .filter((relativePath) => relativePath.startsWith("Meta-Architect/"))
    .filter((relativePath) => relativePath !== mapPath)
    .sort();
  const hasCoreNote = refreshedMaNotes.includes("Meta-Architect/Core Brain Context.md");

  for (const notePath of refreshedMaNotes) {
    const target = await resolveVaultNotePath({
      vaultPath: resolvedVaultPath,
      notePath,
      mustExist: true,
    });
    const current = await fs.readFile(target.absolutePath, "utf8");
    const linked = withObsidianGraphSection(current, {
      currentPath: notePath,
      hasCoreNote,
    });
    if (linked === current) continue;
    await fs.writeFile(target.absolutePath, linked, "utf8");
    receipts.push(
      createObsidianOperationReceipt({
        operation: "update_note",
        target,
        content: linked,
      }),
    );
  }

  return {
    record_type: "obsidian_graph_link_result",
    records_as: "vault_context",
    build_evidence: false,
    semantic_symlink_type: "obsidian_wikilink",
    map_note_path: mapPath,
    linked_note_count: refreshedMaNotes.length + 1,
    operations: receipts,
  };
}

export async function appendObsidianOperationReceipt(receipt) {
  validateObsidianOperationReceipt(receipt);
  let log = createDefaultObsidianVaultOperations();
  try {
    log = validateObsidianVaultOperations(await readJson(getObsidianVaultOperationsPath()));
  } catch {}
  log.operations.push(receipt);
  await writeJson(getObsidianVaultOperationsPath(), log);
  return log;
}

export function validateObsidianBridge(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Obsidian bridge must be an object");
  }
  if (value.schemaVersion !== obsidianIntegrationSchemaVersion) {
    throw new Error(`Unsupported Obsidian bridge schemaVersion: ${value.schemaVersion}`);
  }
  if (
    value.semantic_boundary?.records_as !== "vault_context" ||
    value.semantic_boundary?.never_records_as !== "build_evidence"
  ) {
    throw new Error("Obsidian bridge must record as vault_context, not build_evidence");
  }
  if (value.plugin_contract?.authoritative_changes_return_through !== "$maestro_or_owning_lane") {
    throw new Error("Obsidian bridge authoritative changes must return through MA lanes");
  }
  if (
    value.graph_link_policy?.enabled_by_default !== true ||
    value.graph_link_policy?.semantic_symlink_type !== "obsidian_wikilink" ||
    value.graph_link_policy?.map_note_path !== obsidianGraphMapNotePath ||
    value.graph_link_policy?.records_as !== "vault_context" ||
    value.graph_link_policy?.build_evidence !== false
  ) {
    throw new Error("Obsidian bridge must enable default wikilink graph policy");
  }
  const forbidden = new Set(value.plugin_contract?.must_not_mutate ?? []);
  for (const required of [".ma/release.json", ".ma/decisions.json", ".ma/plans/", ".ma/specs/"]) {
    if (!forbidden.has(required)) {
      throw new Error(`Obsidian bridge must forbid direct mutation of ${required}`);
    }
  }
  if (!Array.isArray(value.default_request_queue)) {
    throw new Error("Obsidian bridge requires a request queue");
  }
  if (
    value.plugin_runtime?.plugin_id !== "meta-architect" ||
    value.plugin_runtime?.records_as !== "vault_context" ||
    value.plugin_runtime?.build_evidence !== false ||
    !Array.isArray(value.plugin_runtime?.capabilities)
  ) {
    throw new Error("Obsidian bridge requires the default MA in-app plugin runtime");
  }
  for (const capability of [
    "in_app_plugin_surface",
    "active_note_selection_context",
    "metadata_cache_deep_graph",
    "frontmatter_authority_layer",
    "link_safe_rename_move",
    "protocol_handler",
    "event_watchers",
    "canvas_visual_workspace_context",
    "attachments_binary_resources",
    "plugin_request_queue",
  ]) {
    if (!value.plugin_runtime.capabilities.some((entry) => entry.capability === capability)) {
      throw new Error(`Obsidian plugin runtime missing capability: ${capability}`);
    }
  }
  if (!Array.isArray(value.note_selection_metadata)) {
    throw new Error("Obsidian bridge requires note selection metadata");
  }
  if (!Array.isArray(value.tag_graph_claims)) {
    throw new Error("Obsidian bridge requires tag graph claims");
  }
  return value;
}

export function validateObsidianVaultOperations(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Obsidian vault operations must be an object");
  }
  if (value.schemaVersion !== obsidianIntegrationSchemaVersion) {
    throw new Error(`Unsupported Obsidian operations schemaVersion: ${value.schemaVersion}`);
  }
  if (
    value.record_type !== "obsidian_vault_operations" ||
    value.records_as !== "vault_context" ||
    value.build_evidence !== false ||
    value.authority_boundary !== "$maestro_or_owning_lane" ||
    !Array.isArray(value.operations)
  ) {
    throw new Error("Obsidian vault operations must remain lane-owned vault_context");
  }
  for (const operation of value.operations) {
    validateObsidianOperationReceipt(operation);
  }
  return value;
}

export function validateObsidianOperationReceipt(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Obsidian operation receipt must be an object");
  }
  if (
    !["create_note", "read_note", "update_note", "delete_note", "plugin_install"].includes(
      value.operation,
    ) ||
    value.records_as !== "vault_context" ||
    value.build_evidence !== false ||
    value.authority_boundary !== "$maestro_or_owning_lane" ||
    typeof value.relative_path !== "string" ||
    typeof value.content_sha256 !== "string"
  ) {
    throw new Error("Obsidian operation receipt must be lane-owned vault_context");
  }
  return value;
}

export function validateObsidianVaultIndex(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Obsidian vault index must be an object");
  }
  if (value.schemaVersion !== obsidianIntegrationSchemaVersion) {
    throw new Error(`Unsupported Obsidian vault index schemaVersion: ${value.schemaVersion}`);
  }
  if (
    value.record_type !== "obsidian_vault_index" ||
    value.records_as !== "vault_context" ||
    value.build_evidence !== false ||
    value.read_only_snapshot !== true
  ) {
    throw new Error("Obsidian vault index must be read-only vault_context");
  }
  if (!Number.isInteger(value.note_count) || value.note_count < 0) {
    throw new Error("Obsidian vault index requires note_count");
  }
  if (!Array.isArray(value.notes) || value.notes.length !== value.note_count) {
    throw new Error("Obsidian vault index notes must match note_count");
  }
  for (const note of value.notes) {
    if (
      note.record_type !== "vault_context_note" ||
      note.records_as !== "vault_context" ||
      note.build_evidence !== false ||
      typeof note.relative_path !== "string" ||
      typeof note.content_sha256 !== "string"
    ) {
      throw new Error("Obsidian vault index note entries must be vault_context notes");
    }
  }
  for (const claim of value.tag_graph_claims ?? []) {
    if (claim.records_as !== "vault_context" || claim.build_evidence !== false) {
      throw new Error("Obsidian tag graph claims must remain vault_context");
    }
  }
  return value;
}

export async function seedObsidianBridgeArtifacts() {
  await ensureDir(getRuntimeSubsystemPath("context"));
  await writeFileIfMissing(
    getObsidianBridgePath(),
    `${JSON.stringify(createDefaultObsidianBridge(), null, 2)}\n`,
  );
  await writeFileIfMissing(
    getObsidianVaultIndexPath(),
    `${JSON.stringify(createDefaultObsidianVaultIndex(), null, 2)}\n`,
  );
  await writeFileIfMissing(
    getObsidianVaultOperationsPath(),
    `${JSON.stringify(createDefaultObsidianVaultOperations(), null, 2)}\n`,
  );
}

export async function loadObsidianBridge() {
  return validateObsidianBridge(await readJson(getObsidianBridgePath()));
}

export async function loadObsidianVaultIndex() {
  return validateObsidianVaultIndex(await readJson(getObsidianVaultIndexPath()));
}

export async function loadObsidianVaultOperations() {
  return validateObsidianVaultOperations(await readJson(getObsidianVaultOperationsPath()));
}

export async function writeObsidianVaultIndex({ vaultPath, ensureGraphLinks = true } = {}) {
  if (ensureGraphLinks) {
    const graph = await ensureObsidianGraphLinks({ vaultPath });
    for (const receipt of graph.operations) {
      await appendObsidianOperationReceipt(receipt);
    }
  }
  const index = await indexObsidianVault({ vaultPath });
  await writeJson(getObsidianVaultIndexPath(), index);
  return index;
}

async function upsertObsidianNoteContent({ vaultPath, notePath, content }) {
  const target = await resolveVaultNotePath({ vaultPath, notePath, mustExist: false });
  let current = null;
  if (await pathExists(target.absolutePath)) {
    current = await fs.readFile(target.absolutePath, "utf8");
  }
  if (current === content) return null;

  await fs.mkdir(path.dirname(target.absolutePath), { recursive: true });
  await fs.writeFile(target.absolutePath, content, "utf8");
  return createObsidianOperationReceipt({
    operation: current === null ? "create_note" : "update_note",
    target,
    content,
  });
}

function createObsidianGraphMapContent(notePaths) {
  const noteLinks = [...new Set(notePaths)]
    .filter((notePath) => notePath !== obsidianGraphMapNotePath)
    .sort()
    .map((notePath) => `- ${toObsidianWikiLink(notePath)} — MA vault context note.`);
  const noteList =
    noteLinks.length > 0 ? noteLinks.join("\n") : "- No MA context notes have been recorded yet.";

  return `# Meta-Architect Map of Content

This is the canonical Obsidian graph hub for Meta-Architect vault context. MA creates and maintains this note automatically when a vault is indexed or when MA performs vault CRUD.

## Canonical MA Notes

${noteList}

## Core Capability Links

- Obsidian Integration Core uses wikilinks as semantic symlinks between MA vault notes.
- Context Economy Core preserves technical meaning while keeping note text compact when applicable.
- Ralph Execution Core and Active Autonomy Core use these notes as vault_context only.

## Evidence Boundary

These linked notes are vault_context. They are not build_evidence. Build evidence stays in MA lane artifacts and command outputs.

## Graph Rules

- Every MA-generated Obsidian note links back to ${toObsidianWikiLink(obsidianGraphMapNotePath, "MA Map of Content")}.
- The map links every note under Meta-Architect/.
- Obsidian links are semantic graph links, not release authority. They must not mutate .ma/release.json, .ma/decisions.json, or lane artifacts directly.

#ma/core #ma/map #ma/obsidian #ma/vault-context
`;
}

function withObsidianGraphSection(content, { currentPath, hasCoreNote }) {
  const base = content
    .replace(new RegExp(`\\n${escapeRegExp(obsidianGraphSectionHeading)}[\\s\\S]*$`, "m"), "")
    .trimEnd();
  const links = [`- Hub: ${toObsidianWikiLink(obsidianGraphMapNotePath, "MA Map of Content")}`];
  if (hasCoreNote && currentPath !== "Meta-Architect/Core Brain Context.md") {
    links.push(
      `- Core context: ${toObsidianWikiLink("Meta-Architect/Core Brain Context.md", "Core Brain Context")}`,
    );
  }
  links.push("- This note records as vault_context, not build_evidence.");

  return `${base}

${obsidianGraphSectionHeading}

${links.join("\n")}
`;
}

function toObsidianWikiLink(notePath, alias = null) {
  const target = normalizeVaultPath(notePath).replace(/\.md$/i, "");
  return alias ? `[[${target}|${alias}]]` : `[[${target}]]`;
}

function createObsidianOperationReceipt({ operation, target, content }) {
  return validateObsidianOperationReceipt({
    record_type: "obsidian_vault_operation",
    operation,
    records_as: "vault_context",
    build_evidence: false,
    authority_boundary: "$maestro_or_owning_lane",
    vault_path: target.vaultPath,
    relative_path: target.relativePath,
    content_sha256: createHash("sha256").update(content).digest("hex"),
    char_count: content.length,
    word_count: countWords(content),
    operated_at: new Date().toISOString(),
  });
}

async function resolveVaultRoot(vaultPath) {
  if (!vaultPath || typeof vaultPath !== "string") {
    throw new Error("Obsidian vault operation requires vaultPath");
  }
  const resolvedVaultPath = path.resolve(vaultPath);
  const stat = await fs.stat(resolvedVaultPath);
  if (!stat.isDirectory()) {
    throw new Error(`Obsidian vault path is not a directory: ${resolvedVaultPath}`);
  }
  return resolvedVaultPath;
}

async function resolveVaultNotePath({ vaultPath, notePath, mustExist }) {
  const resolvedVaultPath = await resolveVaultRoot(vaultPath);
  if (!notePath || typeof notePath !== "string") {
    throw new Error("Obsidian note operation requires notePath");
  }
  const normalizedInput = normalizeVaultPath(notePath.trim()).replace(/^\/+/, "");
  if (
    !normalizedInput ||
    normalizedInput.startsWith("../") ||
    normalizedInput.includes("/../") ||
    normalizedInput === ".."
  ) {
    throw new Error("Obsidian note path must stay inside the vault");
  }
  if (
    normalizedInput.startsWith(".obsidian/") ||
    normalizedInput.startsWith(".trash/") ||
    normalizedInput.startsWith(".git/")
  ) {
    throw new Error("Obsidian note operation cannot target vault control directories");
  }
  const relativePath = normalizedInput.toLowerCase().endsWith(".md")
    ? normalizedInput
    : `${normalizedInput}.md`;
  const absolutePath = path.resolve(resolvedVaultPath, relativePath);
  if (!absolutePath.startsWith(`${resolvedVaultPath}${path.sep}`)) {
    throw new Error("Obsidian note path resolved outside the vault");
  }
  if (mustExist && !(await pathExists(absolutePath))) {
    throw new Error(`Obsidian note does not exist: ${relativePath}`);
  }
  return { vaultPath: resolvedVaultPath, relativePath, absolutePath };
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listMarkdownNotes(root) {
  const result = [];
  async function walk(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".obsidian" || entry.name === ".trash" || entry.name === ".git") {
        continue;
      }
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        result.push(absolutePath);
      }
    }
  }
  await walk(root);
  return result.sort();
}

function extractTitle(content) {
  const heading = content.match(/^#\s+(.+)$/m);
  return heading?.[1]?.trim() || null;
}

function extractObsidianTags(content) {
  const tags = new Set();
  const frontmatter = content.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatter) {
    const tagBlock = frontmatter[1].match(/^tags:\s*([\s\S]*?)(?:\n\S|\n?$)/m);
    if (tagBlock) {
      for (const tag of tagBlock[1].split(/[\s,[\]]+/)) {
        addTag(tags, tag);
      }
    }
  }
  for (const match of content.matchAll(/(^|[\s([{])#([A-Za-z0-9_/-]+)/g)) {
    addTag(tags, match[2]);
  }
  return [...tags].sort();
}

function extractObsidianLinks(content) {
  const links = [];
  for (const match of content.matchAll(/\[\[([^\]\n]+)\]\]/g)) {
    const [target, alias] = match[1].split("|").map((part) => part.trim());
    links.push({ type: "wikilink", target, alias: alias || null });
  }
  for (const match of content.matchAll(/\[[^\]\n]+\]\(([^)\n]+)\)/g)) {
    const target = match[1].trim();
    if (!target.startsWith("http://") && !target.startsWith("https://")) {
      links.push({ type: "markdown", target, alias: null });
    }
  }
  return links.sort((a, b) => a.target.localeCompare(b.target));
}

function addTag(tags, value) {
  const cleaned = value?.trim().replace(/^#/, "").replace(/,$/, "");
  if (cleaned && /^[A-Za-z0-9_/-]+$/.test(cleaned)) {
    tags.add(cleaned);
  }
}

function normalizeVaultPath(value) {
  return value.split(path.sep).join("/");
}

function normalizeLinkKey(value) {
  return normalizeVaultPath(String(value).trim())
    .replace(/\.md$/i, "")
    .replace(/^\/+/, "")
    .toLowerCase();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countWords(content) {
  return content.split(/\s+/).filter(Boolean).length;
}

function createExcerpt(content, maxChars) {
  return content
    .replace(/^---\n[\s\S]*?\n---/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxChars);
}
