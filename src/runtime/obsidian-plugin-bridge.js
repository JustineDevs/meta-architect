import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const obsidianPluginId = "meta-architect";
export const obsidianPluginName = "Meta-Architect";
export const obsidianPluginSchemaVersion = "0.1.0";
export const obsidianPluginQueuePath = "Meta-Architect/Plugin Requests/request-queue.json";
export const obsidianPluginActiveContextPath =
  "Meta-Architect/Plugin Context/Active Note Context.md";
export const obsidianPluginAttachmentDir = "Meta-Architect/Attachments";
const defaultAttachmentMaxBytes = 1_048_576;
const defaultAttachmentContentTypes = new Set([
  "application/octet-stream",
  "application/json",
  "text/plain",
  "text/markdown",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const forbiddenMaTargets = [".ma/release.json", ".ma/decisions.json", ".ma/plans/", ".ma/specs/"];
const protocolMaxPayloadBytes = 64 * 1024;
const protocolActions = new Set(["queue", "capture", "open"]);
const protocolFields = new Set([
  "action",
  "open",
  "path",
  "note_path",
  "from",
  "to",
  "content",
  "data",
  "content_type",
  "overwrite",
  "id",
  "authority",
  "records_as",
  "protocol_token",
  "protocol_token_hash",
]);

const pluginCapabilityNames = [
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
];

export function createDefaultObsidianPluginBridgeManifest() {
  return {
    schemaVersion: obsidianPluginSchemaVersion,
    plugin_id: obsidianPluginId,
    plugin_name: obsidianPluginName,
    records_as: "vault_context",
    build_evidence: false,
    semantic_role: "brain_context",
    canonical_queue_path: obsidianPluginQueuePath,
    active_context_note_path: obsidianPluginActiveContextPath,
    attachment_directory: obsidianPluginAttachmentDir,
    capabilities: pluginCapabilityNames.map((capability) => ({
      capability,
      enabled_by_default: true,
      records_as: "vault_context",
      build_evidence: false,
    })),
    authority_boundary: {
      authoritative_changes_return_through: "$maestro_or_owning_lane",
      must_not_mutate: [...forbiddenMaTargets],
    },
  };
}

export async function installObsidianPlugin({
  vaultPath,
  pluginId = obsidianPluginId,
  packageRoot = getPackageRoot(),
  enable = true,
} = {}) {
  if (!vaultPath || typeof vaultPath !== "string") {
    throw new Error("Obsidian plugin install requires vaultPath");
  }
  if (
    typeof pluginId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(pluginId) ||
    path.isAbsolute(pluginId)
  ) {
    throw new Error(`Invalid Obsidian plugin id: ${pluginId}`);
  }
  const resolvedVaultPath = path.resolve(vaultPath);
  const vaultStat = await fs.stat(resolvedVaultPath);
  if (!vaultStat.isDirectory()) {
    throw new Error(`Obsidian vault path is not a directory: ${resolvedVaultPath}`);
  }

  const sourceDir = path.join(packageRoot, "plugins", "meta-architect", "obsidian");
  const targetDir = path.join(resolvedVaultPath, ".obsidian", "plugins", pluginId);
  const relativeTarget = path.relative(resolvedVaultPath, path.resolve(targetDir));
  if (relativeTarget.startsWith(`..${path.sep}`) || path.isAbsolute(relativeTarget)) {
    throw new Error("Obsidian plugin target must remain inside the vault");
  }
  await assertNoSymlinkComponents(resolvedVaultPath, targetDir);
  await assertNoSymlinkComponents(
    resolvedVaultPath,
    path.join(resolvedVaultPath, ".obsidian", "community-plugins.json"),
  );
  const sourceMainPath = path.join(sourceDir, "main.js");
  const sourceManifestPath = path.join(sourceDir, "manifest.json");
  const configPath = path.join(resolvedVaultPath, ".obsidian", "community-plugins.json");
  const originalConfig = await readOptionalFile(configPath);
  if (enable) parseCommunityPlugins(originalConfig);
  const stagingDir = `${targetDir}.staging-${Date.now()}`;
  const backupDir = `${targetDir}.backup-${Date.now()}`;
  let hadTarget = false;
  let installed = false;
  try {
    await fs.mkdir(path.dirname(targetDir), { recursive: true });
    await fs.cp(sourceDir, stagingDir, { recursive: true, force: true });

    const manifest = JSON.parse(await fs.readFile(path.join(stagingDir, "manifest.json"), "utf8"));
    if (manifest.id !== pluginId) {
      throw new Error(`Installed Obsidian plugin manifest id mismatch: ${manifest.id}`);
    }
    const sourceHash = await hashFile(sourceMainPath);
    const installedHash = await hashFile(path.join(stagingDir, "main.js"));
    const sourceManifestHash = await hashFile(sourceManifestPath);
    const installedManifestHash = await hashFile(path.join(stagingDir, "manifest.json"));
    if (sourceHash !== installedHash || sourceManifestHash !== installedManifestHash) {
      throw new Error("Installed Obsidian plugin integrity mismatch");
    }

    hadTarget = await pathExists(targetDir);
    if (hadTarget) await fs.rename(targetDir, backupDir);
    await fs.rename(stagingDir, targetDir);
    installed = true;
    const enabledPlugins = enable
      ? await enableObsidianCommunityPlugin({ vaultPath: resolvedVaultPath, pluginId })
      : null;

    const installedFiles = await listPluginFiles(targetDir);
    await fs.rm(backupDir, { recursive: true, force: true });
    return {
      record_type: "obsidian_plugin_install",
      records_as: "vault_context",
      build_evidence: false,
      enabled: enable,
      community_plugins: enabledPlugins,
      plugin_id: pluginId,
      vault_path: resolvedVaultPath,
      plugin_path: targetDir,
      source_hash: sourceHash,
      installed_hash: installedHash,
      source_manifest_hash: sourceManifestHash,
      installed_manifest_hash: installedManifestHash,
      installed_files: installedFiles,
    };
  } catch (error) {
    await fs.rm(stagingDir, { recursive: true, force: true });
    if (installed) await fs.rm(targetDir, { recursive: true, force: true });
    if (hadTarget) await fs.rename(backupDir, targetDir);
    if (originalConfig === null) await fs.rm(configPath, { force: true });
    else await fs.writeFile(configPath, originalConfig, "utf8");
    throw error;
  }
}

export async function registerMetaArchitectObsidianPluginRuntime({
  plugin,
  app = plugin?.app,
  Notice,
  Modal,
  PluginSettingTab,
  Setting,
  MarkdownView,
  settings = {},
} = {}) {
  if (!plugin || !app) {
    throw new Error("Obsidian plugin runtime registration requires plugin and app");
  }

  const statusBar = plugin.addStatusBarItem?.();
  statusBar?.setText?.("MA: vault context");

  plugin.addRibbonIcon?.("network", "Send current note/selection to Meta-Architect", async () => {
    await captureActiveNoteToVault({ app, Notice, MarkdownView, settings });
  });

  plugin.addCommand?.({
    id: "ma-capture-active-note",
    name: "Send current note/selection to MA",
    callback: async () => {
      await captureActiveNoteToVault({ app, Notice, MarkdownView, settings });
    },
  });

  plugin.addCommand?.({
    id: "ma-drain-request-queue",
    name: "Drain MA request queue",
    callback: async () => {
      const result = await drainQueueFromVault({ app, MarkdownView, settings });
      if (Notice) {
        new Notice(
          `MA queue drained: ${result.processed.length} processed, ${result.refused.length} refused`,
        );
      }
    },
  });

  plugin.addCommand?.({
    id: "ma-open-map",
    name: "Open MA map of content",
    callback: async () => {
      const file = app.vault?.getAbstractFileByPath?.("Meta-Architect/Map of Content.md");
      if (file) await app.workspace?.getLeaf?.(true)?.openFile?.(file);
    },
  });

  if (PluginSettingTab && Setting && app) {
    plugin.addSettingTab?.(createMetaArchitectSettingTab(app, plugin, PluginSettingTab, Setting));
  }

  const protocol = registerObsidianProtocolHandlers({ plugin, app, MarkdownView, settings });
  const watchers = registerObsidianEventWatchers({
    plugin,
    app,
    onEvent: async () => {
      await drainQueueFromVault({ app, MarkdownView, settings }).catch(() => {});
    },
  });

  return {
    record_type: "obsidian_plugin_runtime_registration",
    records_as: "vault_context",
    build_evidence: false,
    ribbon: true,
    status_bar: Boolean(statusBar),
    commands: ["ma-capture-active-note", "ma-drain-request-queue", "ma-open-map"],
    settings_tab: Boolean(PluginSettingTab && Setting),
    protocol,
    watchers,
    modal_available: Boolean(Modal),
  };
}

export function createObsidianSelectionContext({ app, MarkdownView } = {}) {
  const file = app?.workspace?.getActiveFile?.() ?? null;
  const view = app?.workspace?.getActiveViewOfType?.(MarkdownView) ?? null;
  const leaf = app?.workspace?.activeLeaf ?? null;
  const editor = view?.editor ?? leaf?.view?.editor ?? null;
  const selection = safeCall(() => editor?.getSelection?.()) ?? "";
  const cursor = safeCall(() => editor?.getCursor?.()) ?? null;

  return {
    record_type: "obsidian_active_note_context",
    records_as: "vault_context",
    build_evidence: false,
    captured_at: new Date().toISOString(),
    active_note_path: file?.path ?? null,
    active_note_basename: file?.basename ?? basenameWithoutExtension(file?.path),
    selected_text: selection,
    selected_text_char_count: selection.length,
    cursor,
    pane_state: safeCall(() => leaf?.getViewState?.()) ?? null,
    view_type: view?.getViewType?.() ?? leaf?.view?.getViewType?.() ?? null,
  };
}

export function createObsidianMetadataGraph({ app, files } = {}) {
  const metadataCache = app?.metadataCache;
  const vault = app?.vault;
  const candidatePaths = files?.map((file) => file.path ?? file).filter(Boolean);
  const cachedPaths = candidatePaths ?? metadataCache?.getCachedFiles?.() ?? [];
  const nodes = [];

  for (const filePath of cachedPaths) {
    const file = typeof filePath === "string" ? vault?.getAbstractFileByPath?.(filePath) : filePath;
    const resolvedPath = file?.path ?? filePath;
    if (!resolvedPath || typeof resolvedPath !== "string" || !resolvedPath.endsWith(".md")) {
      continue;
    }
    const cache = metadataCache?.getFileCache?.(file ?? { path: resolvedPath }) ?? {};
    nodes.push({
      path: resolvedPath,
      records_as: "vault_context",
      build_evidence: false,
      frontmatter: cache.frontmatter ?? {},
      headings: cache.headings ?? [],
      links: cache.links ?? [],
      embeds: cache.embeds ?? [],
      tags: cache.tags ?? [],
      blocks: cache.blocks ?? {},
      sections: cache.sections ?? [],
      resolved_links: metadataCache?.resolvedLinks?.[resolvedPath] ?? {},
      unresolved_links: metadataCache?.unresolvedLinks?.[resolvedPath] ?? {},
    });
  }

  return {
    record_type: "obsidian_metadata_cache_graph",
    records_as: "vault_context",
    build_evidence: false,
    indexed_at: new Date().toISOString(),
    note_count: nodes.length,
    nodes,
  };
}

export async function applyObsidianFrontmatterAuthority({
  app,
  file,
  project = "Meta-Architect",
  capabilities = pluginCapabilityNames,
  sourceWorkspace = null,
} = {}) {
  if (!app?.fileManager?.processFrontMatter) {
    throw new Error("Obsidian FileManager.processFrontMatter is required");
  }
  if (!file?.path) {
    throw new Error("Obsidian frontmatter authority requires a file");
  }
  await app.fileManager.processFrontMatter(file, (frontmatter) => {
    frontmatter.ma_records_as = "vault_context";
    frontmatter.ma_project = project;
    frontmatter.ma_capabilities = [...new Set(capabilities)];
    if (sourceWorkspace) frontmatter.ma_source_workspace = sourceWorkspace;
  });
  return {
    record_type: "obsidian_frontmatter_authority",
    records_as: "vault_context",
    build_evidence: false,
    note_path: file.path,
    ma_project: project,
  };
}

export async function renameObsidianFileSafely({ app, file, newPath } = {}) {
  assertSafeVaultPath(file?.path);
  assertSafeVaultPath(newPath);
  if (!app?.fileManager?.renameFile) {
    throw new Error("Obsidian FileManager.renameFile is required for link-safe rename/move");
  }
  if (!file?.path) {
    throw new Error("Obsidian link-safe rename requires a file");
  }
  await app.fileManager.renameFile(file, newPath);
  return {
    record_type: "obsidian_link_safe_rename",
    records_as: "vault_context",
    build_evidence: false,
    from: file.path,
    to: newPath,
    method: "FileManager.renameFile",
  };
}

export function generateObsidianMarkdownLink({ app, file, sourcePath = "", subpath, alias } = {}) {
  if (!app?.fileManager?.generateMarkdownLink) {
    throw new Error("Obsidian FileManager.generateMarkdownLink is required");
  }
  const link = app.fileManager.generateMarkdownLink(file, sourcePath, subpath, alias);
  return {
    record_type: "obsidian_generated_markdown_link",
    records_as: "vault_context",
    build_evidence: false,
    link,
  };
}

export function registerObsidianProtocolHandlers({
  plugin,
  app,
  MarkdownView,
  settings = {},
} = {}) {
  if (!plugin?.registerObsidianProtocolHandler) {
    return { registered: false, handler: "ma", reason: "protocol_handler_unavailable" };
  }
  plugin.registerObsidianProtocolHandler("ma", async (params = {}) => {
    const request = validateProtocolRequest(params);
    if (request.action === "queue") {
      if (!hasProtocolAuthority(params, settings)) {
        throw new Error("obsidian_protocol_queue_authority_required");
      }
      return writeQueueRequestToVault({ app, request, settings });
    }
    if (request.action === "capture") {
      if (!hasProtocolAuthority(request, settings)) {
        throw new Error("obsidian_protocol_authority_required");
      }
      await captureActiveNoteToVault({ app, MarkdownView, settings });
      return protocolReceipt("capture", request);
    }
    if (!hasProtocolAuthority(request, settings)) {
      throw new Error("obsidian_protocol_authority_required");
    }
    const target = request.path ?? "Meta-Architect/Map of Content.md";
    assertSafeVaultPath(target);
    const file = app?.vault?.getAbstractFileByPath?.(target);
    if (file) await app?.workspace?.getLeaf?.(true)?.openFile?.(file);
    return protocolReceipt("open", request);
  });
  return { registered: true, handler: "ma", supports: ["open", "queue", "capture"] };
}

export function registerObsidianEventWatchers({ plugin, app, onEvent = () => {} } = {}) {
  const registrations = [];
  const register = (source, eventName, eventRef) => {
    if (!eventRef) return;
    plugin?.registerEvent?.(eventRef);
    registrations.push({ source, event: eventName });
  };
  const vault = app?.vault;
  const metadataCache = app?.metadataCache;
  const workspace = app?.workspace;

  for (const eventName of ["create", "modify", "delete", "rename"]) {
    register(
      "vault",
      eventName,
      vault?.on?.(eventName, (...args) => onEvent({ source: "vault", eventName, args })),
    );
  }
  for (const eventName of ["resolved", "changed", "deleted"]) {
    register(
      "metadataCache",
      eventName,
      metadataCache?.on?.(eventName, (...args) =>
        onEvent({ source: "metadataCache", eventName, args }),
      ),
    );
  }
  for (const eventName of ["active-leaf-change", "layout-change"]) {
    register(
      "workspace",
      eventName,
      workspace?.on?.(eventName, (...args) => onEvent({ source: "workspace", eventName, args })),
    );
  }

  return {
    record_type: "obsidian_event_watchers",
    records_as: "vault_context",
    build_evidence: false,
    registered_count: registrations.length,
    registrations,
  };
}

export async function extractObsidianCanvasContext({ app, files } = {}) {
  const vault = app?.vault;
  const candidatePaths =
    files?.map((file) => file.path ?? file).filter(Boolean) ??
    app?.metadataCache?.getCachedFiles?.()?.filter((filePath) => filePath.endsWith(".canvas")) ??
    [];
  const canvases = [];

  for (const filePath of candidatePaths) {
    if (!filePath.endsWith(".canvas")) continue;
    const file = vault?.getAbstractFileByPath?.(filePath) ?? { path: filePath };
    const raw = await vault?.read?.(file);
    if (typeof raw !== "string") continue;
    const parsed = JSON.parse(raw);
    canvases.push({
      path: filePath,
      records_as: "vault_context",
      build_evidence: false,
      nodes: parsed.nodes ?? [],
      edges: parsed.edges ?? [],
    });
  }

  return {
    record_type: "obsidian_canvas_context",
    records_as: "vault_context",
    build_evidence: false,
    canvas_count: canvases.length,
    canvases,
  };
}

export async function writeObsidianAttachment({
  app,
  attachmentPath,
  data,
  contentType = "application/octet-stream",
  overwrite = false,
  maxBytes = defaultAttachmentMaxBytes,
  allowedContentTypes = defaultAttachmentContentTypes,
  requestId = null,
  sourceAction = null,
} = {}) {
  assertSafeVaultPath(attachmentPath);
  assertMaOwnedPath(attachmentPath, "Meta-Architect/Attachments/");
  if (!attachmentPath) {
    throw new Error("Obsidian attachment write requires attachmentPath");
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new Error("attachment_max_bytes_invalid");
  }
  const bytes = toUint8Array(data);
  if (bytes.byteLength > maxBytes) {
    throw new Error(`attachment_too_large:${attachmentPath}:${bytes.byteLength}`);
  }
  if (!isAllowedAttachmentContentType(contentType, allowedContentTypes)) {
    throw new Error(`attachment_type_forbidden:${contentType}`);
  }
  const parent = attachmentPath.includes("/")
    ? attachmentPath.slice(0, attachmentPath.lastIndexOf("/"))
    : "";
  if (parent) await ensureVaultFolder(app, parent);
  const existing = app?.vault?.getAbstractFileByPath?.(attachmentPath);
  if (existing && !overwrite) {
    throw new Error(`attachment_exists:${attachmentPath}`);
  }

  if (existing && app?.vault?.adapter?.writeBinary) {
    await app.vault.adapter.writeBinary(attachmentPath, bytes);
  } else if (app?.vault?.createBinary) {
    await app.vault.createBinary(
      attachmentPath,
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    );
  } else if (app?.vault?.adapter?.writeBinary) {
    await app.vault.adapter.writeBinary(attachmentPath, bytes);
  } else {
    throw new Error("Obsidian Vault.createBinary or DataAdapter.writeBinary is required");
  }

  return {
    record_type: "obsidian_attachment_write",
    records_as: "vault_context",
    build_evidence: false,
    attachment_path: attachmentPath,
    content_type: contentType,
    byte_length: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    request_id: requestId,
    source_action: sourceAction,
  };
}

export async function drainObsidianPluginRequestQueue({
  app,
  queue = [],
  MarkdownView,
  settings = {},
} = {}) {
  if (!Array.isArray(queue)) {
    throw new Error("Obsidian plugin request queue must be an array");
  }
  const processed = [];
  const refused = [];
  const refusedQueueItems = [];

  for (const request of queue) {
    try {
      if (!request || typeof request !== "object") {
        throw new Error("invalid_request");
      }
      if (
        ["capture_active_note", "create_note", "rename_note", "write_attachment"].includes(
          request.action,
        ) &&
        !hasProtocolAuthority(request, settings)
      ) {
        throw new Error("obsidian_queue_authority_required");
      }
      const target = request.note_path ?? request.path ?? "";
      if (target) assertSafeVaultPath(target);
      switch (request.action) {
        case "capture_active_note":
          processed.push({
            request_id: request.id ?? null,
            action: request.action,
            result: await captureActiveNoteToVault({ app, MarkdownView, settings }),
          });
          break;
        case "create_note":
          processed.push({
            request_id: request.id ?? null,
            action: request.action,
            result: await createVaultContextNote({
              app,
              notePath: target,
              content: request.content,
            }),
          });
          break;
        case "index_vault":
          processed.push({
            request_id: request.id ?? null,
            action: request.action,
            result: createObsidianMetadataGraph({ app }),
          });
          break;
        case "rename_note":
          processed.push({
            request_id: request.id ?? null,
            action: request.action,
            result: await renameObsidianFileSafely({
              app,
              file: app?.vault?.getAbstractFileByPath?.(request.from),
              newPath: request.to,
            }),
          });
          break;
        case "write_attachment":
          processed.push({
            request_id: request.id ?? null,
            action: request.action,
            result: await writeObsidianAttachment({
              app,
              attachmentPath: target,
              data: request.data ?? "",
              contentType: request.content_type,
              overwrite: request.overwrite ?? false,
              maxBytes: defaultAttachmentMaxBytes,
              allowedContentTypes: defaultAttachmentContentTypes,
              requestId: request.id ?? null,
              sourceAction: request.action,
            }),
          });
          break;
        default:
          throw new Error(`unsupported_action:${request.action}`);
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const previousAttempts = Number.isInteger(request?.attempts) ? request.attempts : 0;
      refusedQueueItems.push({
        ...safeClone(request),
        queue_status: "refused",
        refusal_reason: reason,
        attempts: previousAttempts + 1,
        last_attempt_at: new Date().toISOString(),
      });
      refused.push({
        request_id: request?.id ?? null,
        action: request?.action ?? null,
        reason,
        records_as: "vault_context",
        build_evidence: false,
      });
    }
  }

  return {
    record_type: "obsidian_plugin_queue_drain",
    records_as: "vault_context",
    build_evidence: false,
    drained_at: new Date().toISOString(),
    processed,
    refused,
    refusedQueueItems,
  };
}

async function captureActiveNoteToVault({ app, Notice, MarkdownView, settings = {} } = {}) {
  const context = createObsidianSelectionContext({ app, MarkdownView });
  const activeFile = app?.workspace?.getActiveFile?.();
  if (activeFile) {
    await applyObsidianFrontmatterAuthority({
      app,
      file: activeFile,
      project: settings.projectName ?? "Meta-Architect",
      sourceWorkspace: settings.sourceWorkspace ?? null,
    });
  }
  const content = renderActiveContextNote(context);
  const result = await createVaultContextNote({
    app,
    notePath: settings.activeContextPath ?? obsidianPluginActiveContextPath,
    content,
    overwrite: true,
  });
  if (Notice) {
    new Notice("MA captured current Obsidian context");
  }
  return { ...result, active_context: context };
}

let obsidianQueueBusy = Promise.resolve();

function withObsidianQueueLock(task) {
  const previous = obsidianQueueBusy;
  let release;
  obsidianQueueBusy = new Promise((resolve) => {
    release = resolve;
  });
  return previous.then(task).finally(release);
}

async function drainQueueFromVault(args) {
  return withObsidianQueueLock(() => drainQueueFromVaultUnlocked(args));
}

async function drainQueueFromVaultUnlocked({ app, MarkdownView, settings = {} }) {
  const queuePath = settings.queuePath ?? obsidianPluginQueuePath;
  const file = app?.vault?.getAbstractFileByPath?.(queuePath);
  if (!file) {
    return drainObsidianPluginRequestQueue({ app, queue: [], MarkdownView, settings });
  }
  const raw = await app.vault.read(file);
  const queue = JSON.parse(raw);
  const result = await drainObsidianPluginRequestQueue({ app, queue, MarkdownView, settings });
  const nextQueue = `${JSON.stringify(result.refusedQueueItems, null, 2)}\n`;
  if (raw !== nextQueue) await app.vault.modify(file, nextQueue);
  return result;
}

async function writeQueueRequestToVault(args) {
  return withObsidianQueueLock(() => writeQueueRequestToVaultUnlocked(args));
}

async function writeQueueRequestToVaultUnlocked({ app, request, settings = {} }) {
  if (!hasProtocolAuthority(request, settings)) {
    throw new Error("obsidian_protocol_queue_authority_required");
  }
  const queuePath = obsidianPluginQueuePath;
  await ensureVaultFolder(app, path.dirname(queuePath));
  const file = app?.vault?.getAbstractFileByPath?.(queuePath);
  const existing = file ? JSON.parse(await app.vault.read(file)) : [];
  const queuedRequest = Object.fromEntries(
    Object.entries(request).filter(([key]) => key !== "protocol_token"),
  );
  existing.push({
    ...queuedRequest,
    id: request.id ?? `ma-${Date.now()}`,
    queued_at: new Date().toISOString(),
    records_as: "vault_context",
    protocol_token_hash: request.protocol_token_hash ?? tokenHash(request.protocol_token),
  });
  const content = `${JSON.stringify(existing, null, 2)}\n`;
  if (file) await app.vault.modify(file, content);
  else await app.vault.create(queuePath, content);
  return protocolReceipt("queue", request);
}

async function createVaultContextNote({ app, notePath, content, overwrite = true }) {
  assertSafeVaultPath(notePath);
  assertMaOwnedPath(notePath, "Meta-Architect/");
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("vault_context note content required");
  }
  await ensureVaultFolder(app, path.dirname(notePath));
  const normalizedContent = ensureVaultContextFrontmatter(content);
  const existing = app?.vault?.getAbstractFileByPath?.(notePath);
  if (existing && overwrite) {
    await app.vault.modify(existing, normalizedContent);
  } else if (existing) {
    throw new Error(`note_exists:${notePath}`);
  } else {
    await app.vault.create(notePath, normalizedContent);
  }
  return {
    record_type: "obsidian_vault_context_note_write",
    records_as: "vault_context",
    build_evidence: false,
    note_path: notePath,
    char_count: normalizedContent.length,
  };
}

async function ensureVaultFolder(app, folderPath) {
  if (!folderPath || folderPath === ".") return;
  const segments = folderPath.split("/").filter(Boolean);
  let current = "";
  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment;
    if (!app?.vault?.getAbstractFileByPath?.(current)) {
      await app?.vault?.createFolder?.(current).catch(() => {});
    }
  }
}

function renderActiveContextNote(context) {
  return ensureVaultContextFrontmatter(`# Active Note Context

- Active note: ${context.active_note_path ? `[[${context.active_note_path.replace(/\.md$/i, "")}]]` : "none"}
- View type: ${context.view_type ?? "unknown"}
- Cursor: ${JSON.stringify(context.cursor)}
- Selection chars: ${context.selected_text_char_count}

## Selected Text

${context.selected_text || "_No active selection captured._"}

## Pane State

\`\`\`json
${JSON.stringify(context.pane_state ?? {}, null, 2)}
\`\`\`
`);
}

function ensureVaultContextFrontmatter(content) {
  if (content.trimStart().startsWith("---")) {
    return content.replace(
      /^---\n/,
      "---\nma_records_as: vault_context\nma_project: Meta-Architect\n",
    );
  }
  return `---
ma_records_as: vault_context
ma_project: Meta-Architect
ma_capabilities:
  - obsidian_integration_core
---

${content}`;
}

function assertSafeVaultPath(targetPath) {
  if (!targetPath || typeof targetPath !== "string") {
    throw new Error("vault_path_required");
  }
  const normalized = targetPath.replaceAll("\\", "/").replace(/^\/+/, "");
  if (normalized.includes("../") || normalized === ".." || normalized.startsWith("..")) {
    throw new Error("path_traversal_forbidden");
  }
  if ([".obsidian/", ".trash/", ".git/"].some((prefix) => normalized.startsWith(prefix))) {
    throw new Error("vault_control_path_forbidden");
  }
  for (const forbidden of forbiddenMaTargets) {
    if (normalized === forbidden || normalized.startsWith(forbidden)) {
      throw new Error(`forbidden_authoritative_mutation:${forbidden}`);
    }
  }
}

function assertMaOwnedPath(targetPath, prefix) {
  const normalized = targetPath.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized.startsWith(prefix)) throw new Error(`ma_owned_path_required:${prefix}`);
}

function hasVaultContextAuthority(params, settings) {
  const requiredAuthority = settings.protocolAuthority ?? "vault_context";
  return params.authority === requiredAuthority;
}

function hasProtocolAuthority(params, settings) {
  return (
    Boolean(settings.protocolToken) &&
    (params?.protocol_token === settings.protocolToken ||
      params?.protocol_token_hash === tokenHash(settings.protocolToken)) &&
    hasVaultContextAuthority(params, settings)
  );
}

function validateProtocolRequest(params) {
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    throw new Error("obsidian_protocol_request_invalid");
  }
  const serialized = JSON.stringify(params);
  if (Buffer.byteLength(serialized, "utf8") > protocolMaxPayloadBytes) {
    throw new Error("obsidian_protocol_payload_too_large");
  }
  for (const key of Object.keys(params)) {
    if (!protocolFields.has(key)) throw new Error(`obsidian_protocol_field_forbidden:${key}`);
  }
  const action = params.action ?? (params.open === "active" ? "capture" : null);
  if (!protocolActions.has(action)) throw new Error("obsidian_protocol_action_forbidden");
  if (action === "open" && params.open === "active") {
    throw new Error("obsidian_protocol_action_invalid");
  }
  const request = { ...params, action };
  for (const target of [request.path, request.note_path, request.from, request.to]) {
    if (target !== undefined) assertSafeVaultPath(target);
  }
  if (request.content !== undefined && typeof request.content !== "string") {
    throw new Error("obsidian_protocol_content_invalid");
  }
  if (request.data !== undefined && typeof request.data !== "string") {
    throw new Error("obsidian_protocol_data_invalid");
  }
  return request;
}

function protocolReceipt(action, request) {
  return {
    record_type: "obsidian_protocol_action",
    records_as: "vault_context",
    build_evidence: false,
    action,
    request_id: request.id ?? null,
    status: "accepted",
    authority: request.authority,
  };
}

function tokenHash(token) {
  return createHash("sha256")
    .update(String(token ?? ""))
    .digest("hex");
}

async function hashFile(filePath) {
  return createHash("sha256")
    .update(await fs.readFile(filePath))
    .digest("hex");
}

async function assertNoSymlinkComponents(root, target) {
  const rootPath = path.resolve(root);
  const rootStat = await fs.lstat(rootPath);
  if (rootStat.isSymbolicLink()) throw new Error("Obsidian vault root cannot be a symlink");
  let current = rootPath;
  for (const part of path
    .relative(rootPath, path.resolve(target))
    .split(path.sep)
    .filter(Boolean)) {
    current = path.join(current, part);
    const stat = await fs.lstat(current).catch((error) => {
      if (error?.code === "ENOENT") return null;
      throw error;
    });
    if (stat?.isSymbolicLink())
      throw new Error(`Obsidian plugin path cannot traverse a symlink: ${current}`);
  }
}

function isAllowedAttachmentContentType(contentType, allowedContentTypes) {
  if (!contentType || typeof contentType !== "string") {
    return false;
  }
  if (allowedContentTypes instanceof Set) {
    return allowedContentTypes.has(contentType);
  }
  if (Array.isArray(allowedContentTypes)) {
    return allowedContentTypes.includes(contentType);
  }
  return defaultAttachmentContentTypes.has(contentType);
}

function safeClone(value) {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value ?? null));
  }
}

function toUint8Array(data) {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return new TextEncoder().encode(String(data ?? ""));
}

function safeCall(fn) {
  try {
    return fn();
  } catch {
    return null;
  }
}

function basenameWithoutExtension(filePath) {
  if (!filePath) return null;
  return path.basename(filePath, path.extname(filePath));
}

function getPackageRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
}

async function listPluginFiles(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const nested = await listPluginFiles(absolutePath);
      files.push(...nested.map((file) => `${entry.name}/${file}`));
    } else {
      files.push(entry.name);
    }
  }
  return files.sort();
}

async function enableObsidianCommunityPlugin({ vaultPath, pluginId }) {
  const configPath = path.join(vaultPath, ".obsidian", "community-plugins.json");
  await assertNoSymlinkComponents(vaultPath, configPath);
  const enabled = parseCommunityPlugins(await readOptionalFile(configPath));
  if (!enabled.includes(pluginId)) {
    enabled.push(pluginId);
  }
  await fs.writeFile(configPath, `${JSON.stringify(enabled, null, 2)}\n`, "utf8");
  return enabled;
}

async function readOptionalFile(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function pathExists(filePath) {
  try {
    await fs.lstat(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function parseCommunityPlugins(content) {
  if (content === null) return [];
  const parsed = JSON.parse(content);
  return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === "string") : [];
}

function createMetaArchitectSettingTab(app, plugin, PluginSettingTab, Setting) {
  const instance = new PluginSettingTab(app, plugin);
  instance.display = () => {
    const { containerEl } = instance;
    containerEl.empty?.();
    containerEl.createEl?.("h2", { text: "Meta-Architect" });
    new Setting(containerEl)
      .setName("Vault context mode")
      .setDesc("Obsidian notes are recorded as vault_context, never build_evidence.")
      .addText?.((text) =>
        text
          .setPlaceholder("Meta-Architect")
          .setValue?.("Meta-Architect")
          .onChange?.(async () => {}),
      );
  };
  return instance;
}
