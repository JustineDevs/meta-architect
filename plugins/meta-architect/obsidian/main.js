const { MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } = require("obsidian");
const { createHash, randomUUID } = require("node:crypto");

const DEFAULT_SETTINGS = {
  projectName: "Meta-Architect",
  activeContextPath: "Meta-Architect/Plugin Context/Active Note Context.md",
  queuePath: "Meta-Architect/Plugin Requests/request-queue.json",
  attachmentDir: "Meta-Architect/Attachments",
  sourceWorkspace: "",
  protocolToken: "",
};

const FORBIDDEN_TARGETS = [".ma/release.json", ".ma/decisions.json", ".ma/plans/", ".ma/specs/"];
const MAX_ATTACHMENT_BYTES = 1_048_576;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "application/octet-stream",
  "application/json",
  "text/plain",
  "text/markdown",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

module.exports = class MetaArchitectPlugin extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()) || {});
    this.queueBusy = Promise.resolve();
    if (!this.settings.protocolToken) {
      this.settings.protocolToken = randomUUID();
      await this.saveSettings();
    }
    this.addRibbonIcon("network", "Send current note/selection to MA", async () => {
      await this.captureActiveNote();
    });

    const statusBarItem = this.addStatusBarItem();
    statusBarItem.addClass("ma-status");
    statusBarItem.setText("MA: vault context");

    this.addCommand({
      id: "ma-capture-active-note",
      name: "Send current note/selection to MA",
      callback: async () => this.captureActiveNote(),
    });

    this.addCommand({
      id: "ma-drain-request-queue",
      name: "Drain MA request queue",
      callback: async () => {
        const result = await this.drainRequestQueue();
        new Notice(
          `MA queue drained: ${result.processed.length} processed, ${result.refused.length} refused`,
        );
      },
    });

    this.addCommand({
      id: "ma-open-context-preview",
      name: "Preview current MA context",
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return false;
        if (!checking) new ContextPreviewModal(this.app, this.createSelectionContext()).open();
        return true;
      },
    });

    this.addCommand({
      id: "ma-open-map",
      name: "Open MA map of content",
      callback: async () => this.openNote("Meta-Architect/Map of Content.md"),
    });

    this.addSettingTab(new MetaArchitectSettingTab(this.app, this));
    this.registerProtocolHandler();
    this.registerVaultWatchers();
    this.registerInterval(
      window.setInterval(() => this.drainRequestQueue().catch(() => {}), 30 * 1000),
    );
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()) || {});
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  createSelectionContext() {
    const file = this.app.workspace.getActiveFile();
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const leaf = this.app.workspace.activeLeaf;
    const editor = view?.editor || leaf?.view?.editor;
    const selectedText = editor?.getSelection?.() || "";
    return {
      record_type: "obsidian_active_note_context",
      records_as: "vault_context",
      build_evidence: false,
      captured_at: new Date().toISOString(),
      active_note_path: file?.path || null,
      selected_text: selectedText,
      selected_text_char_count: selectedText.length,
      cursor: editor?.getCursor?.() || null,
      pane_state: leaf?.getViewState?.() || null,
      metadata: file ? this.app.metadataCache.getFileCache(file) || {} : {},
    };
  }

  async captureActiveNote() {
    const context = this.createSelectionContext();
    const file = this.app.workspace.getActiveFile();
    if (file) {
      await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        frontmatter.ma_records_as = "vault_context";
        frontmatter.ma_project = this.settings.projectName;
        frontmatter.ma_capabilities = [
          "obsidian_integration_core",
          "active_note_selection_context",
          "metadata_cache_deep_graph",
        ];
        if (this.settings.sourceWorkspace) {
          frontmatter.ma_source_workspace = this.settings.sourceWorkspace;
        }
      });
    }
    await this.writeVaultContextNote(
      this.settings.activeContextPath,
      this.renderContextNote(context),
      true,
    );
    await this.writeBinaryAttachment(
      `${this.settings.attachmentDir}/active-context-${Date.now()}.json`,
      JSON.stringify(context, null, 2),
      "application/json",
    );
    new Notice("MA captured current Obsidian context");
    return context;
  }

  renderContextNote(context) {
    const activeLink = context.active_note_path
      ? this.app.fileManager.generateMarkdownLink(
          this.app.vault.getAbstractFileByPath(context.active_note_path),
          this.settings.activeContextPath,
          undefined,
          "active note",
        )
      : "none";
    return withVaultContextFrontmatter(`# Active Note Context

- Active note: ${activeLink}
- Selection chars: ${context.selected_text_char_count}
- Cursor: ${JSON.stringify(context.cursor)}
- Captured: ${context.captured_at}

## Selected Text

${context.selected_text || "_No active selection captured._"}

## Obsidian MetadataCache

\`\`\`json
${JSON.stringify(context.metadata, null, 2)}
\`\`\`

## Pane State

\`\`\`json
${JSON.stringify(context.pane_state || {}, null, 2)}
\`\`\`
`);
  }

  registerProtocolHandler() {
    this.registerObsidianProtocolHandler("ma", async (params) => {
      if (params.action === "queue") {
        await this.queueRequest(params);
        new Notice("MA request queued");
        return;
      }
      if (params.action === "capture" || params.open === "active") {
        if (!hasProtocolAuthority(params, this.settings)) {
          throw new Error("obsidian_protocol_authority_required");
        }
        await this.captureActiveNote();
        return;
      }
      if (!hasProtocolAuthority(params, this.settings)) {
        throw new Error("obsidian_protocol_authority_required");
      }
      await this.openNote(params.path || "Meta-Architect/Map of Content.md");
    });
  }

  registerVaultWatchers() {
    for (const eventName of ["create", "modify", "delete", "rename"]) {
      this.registerEvent(
        this.app.vault.on(eventName, () => {
          this.drainRequestQueue().catch(() => {});
        }),
      );
    }
    for (const eventName of ["resolved", "changed", "deleted"]) {
      this.registerEvent(
        this.app.metadataCache.on(eventName, () => {
          this.drainRequestQueue().catch(() => {});
        }),
      );
    }
    for (const eventName of ["active-leaf-change", "layout-change"]) {
      this.registerEvent(
        this.app.workspace.on(eventName, () => {
          this.drainRequestQueue().catch(() => {});
        }),
      );
    }
  }

  async queueRequest(params) {
    return this.withQueueLock(() => this.queueRequestUnlocked(params));
  }

  async queueRequestUnlocked(params) {
    if (!hasProtocolAuthority(params, this.settings)) {
      throw new Error("obsidian_protocol_queue_authority_required");
    }
    await this.ensureFolder(this.pathParent(this.settings.queuePath));
    const file = this.app.vault.getAbstractFileByPath(this.settings.queuePath);
    const queue = file ? JSON.parse(await this.app.vault.read(file)) : [];
    queue.push({
      ...Object.fromEntries(Object.entries(params).filter(([key]) => key !== "protocol_token")),
      id: params.id || `ma-${Date.now()}`,
      queued_at: new Date().toISOString(),
      records_as: "vault_context",
      protocol_token_hash: params.protocol_token_hash || tokenHash(params.protocol_token),
    });
    const payload = `${JSON.stringify(queue, null, 2)}\n`;
    if (file) await this.app.vault.modify(file, payload);
    else await this.app.vault.create(this.settings.queuePath, payload);
  }

  async drainRequestQueue() {
    return this.withQueueLock(() => this.drainRequestQueueUnlocked());
  }

  async drainRequestQueueUnlocked() {
    const file = this.app.vault.getAbstractFileByPath(this.settings.queuePath);
    const queue = file ? JSON.parse(await this.app.vault.read(file)) : [];
    const processed = [];
    const refused = [];
    const refusedQueueItems = [];
    for (const request of queue) {
      try {
        const mutating = [
          "capture_active_note",
          "create_note",
          "rename_note",
          "write_attachment",
        ].includes(request.action);
        if (
          (mutating && !hasProtocolAuthority(request, this.settings)) ||
          (!mutating && !hasVaultContextAuthority(request, this.settings))
        ) {
          throw new Error("obsidian_queue_authority_required");
        }
        const target = request.note_path || request.path || "";
        if (target) assertSafeVaultPath(target);
        if (request.action === "capture_active_note") {
          processed.push(await this.captureActiveNote());
        } else if (request.action === "create_note") {
          processed.push(await this.writeVaultContextNote(target, request.content, true));
        } else if (request.action === "rename_note") {
          assertSafeVaultPath(request.from);
          assertSafeVaultPath(request.to);
          const fileToRename = this.app.vault.getAbstractFileByPath(request.from);
          await this.app.fileManager.renameFile(fileToRename, request.to);
          processed.push({ action: "rename_note", from: request.from, to: request.to });
        } else if (request.action === "write_attachment") {
          processed.push(
            await this.writeBinaryAttachment(target, request.data || "", request.content_type),
          );
        } else {
          throw new Error(`unsupported_action:${request.action}`);
        }
      } catch (error) {
        refusedQueueItems.push(request);
        refused.push({
          action: request?.action || null,
          reason: error.message,
          records_as: "vault_context",
          build_evidence: false,
        });
      }
    }
    if (file && queue.length > 0) {
      const nextQueue = `${JSON.stringify(refusedQueueItems, null, 2)}\n`;
      const currentQueue = await this.app.vault.read(file);
      if (currentQueue !== nextQueue) await this.app.vault.modify(file, nextQueue);
    }
    return {
      record_type: "obsidian_plugin_queue_drain",
      records_as: "vault_context",
      build_evidence: false,
      processed,
      refused,
    };
  }

  withQueueLock(task) {
    const previous = this.queueBusy;
    let release;
    this.queueBusy = new Promise((resolve) => {
      release = resolve;
    });
    return previous.then(task).finally(release);
  }

  async writeVaultContextNote(notePath, content, overwrite) {
    assertSafeVaultPath(notePath);
    assertMaOwnedPath(notePath, "Meta-Architect/");
    if (!content?.trim()) throw new Error("vault_context note content required");
    await this.ensureFolder(this.pathParent(notePath));
    const file = this.app.vault.getAbstractFileByPath(notePath);
    const payload = withVaultContextFrontmatter(content);
    if (file && overwrite) await this.app.vault.modify(file, payload);
    else if (file) throw new Error(`note_exists:${notePath}`);
    else await this.app.vault.create(notePath, payload);
    return {
      action: "write_vault_context_note",
      note_path: notePath,
      records_as: "vault_context",
      build_evidence: false,
    };
  }

  async writeBinaryAttachment(attachmentPath, data, contentType) {
    assertSafeVaultPath(attachmentPath);
    assertMaOwnedPath(attachmentPath, "Meta-Architect/Attachments/");
    if (!ALLOWED_ATTACHMENT_TYPES.has(contentType)) {
      throw new Error(`attachment_type_forbidden:${contentType}`);
    }
    await this.ensureFolder(this.pathParent(attachmentPath));
    const bytes = new TextEncoder().encode(String(data || ""));
    if (bytes.byteLength > MAX_ATTACHMENT_BYTES) {
      throw new Error(`attachment_too_large:${attachmentPath}:${bytes.byteLength}`);
    }
    if (this.app.vault.getAbstractFileByPath(attachmentPath)) {
      throw new Error(`attachment_exists:${attachmentPath}`);
    }
    if (this.app.vault.createBinary) {
      await this.app.vault.createBinary(attachmentPath, bytes.buffer);
    } else {
      await this.app.vault.adapter.writeBinary(attachmentPath, bytes.buffer);
    }
    return {
      action: "write_attachment",
      attachment_path: attachmentPath,
      content_type: contentType || "application/octet-stream",
      records_as: "vault_context",
      build_evidence: false,
    };
  }

  async openNote(notePath) {
    const file = this.app.vault.getAbstractFileByPath(notePath);
    if (!file) {
      new Notice(`MA note not found: ${notePath}`);
      return;
    }
    await this.app.workspace.getLeaf(true).openFile(file);
  }

  async ensureFolder(folderPath) {
    if (!folderPath || folderPath === ".") return;
    const segments = folderPath.split("/").filter(Boolean);
    let current = "";
    for (const segment of segments) {
      current = current ? `${current}/${segment}` : segment;
      if (!this.app.vault.getAbstractFileByPath(current)) {
        await this.app.vault.createFolder(current).catch(() => {});
      }
    }
  }

  pathParent(filePath) {
    const parts = filePath.split("/");
    parts.pop();
    return parts.join("/");
  }
};

class ContextPreviewModal extends Modal {
  constructor(app, context) {
    super(app);
    this.context = context;
  }

  onOpen() {
    this.contentEl.addClass("ma-context-modal");
    this.contentEl.createEl("h2", { text: "Meta-Architect Context Preview" });
    this.contentEl.createEl("pre", { text: JSON.stringify(this.context, null, 2) });
  }

  onClose() {
    this.contentEl.empty();
  }
}

class MetaArchitectSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Meta-Architect" });

    new Setting(containerEl)
      .setName("Project name")
      .setDesc("Stored in MA frontmatter as ma_project.")
      .addText((text) =>
        text.setValue(this.plugin.settings.projectName).onChange(async (value) => {
          this.plugin.settings.projectName = value || "Meta-Architect";
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Active context note")
      .setDesc("Where captured note/selection context is written.")
      .addText((text) =>
        text.setValue(this.plugin.settings.activeContextPath).onChange(async (value) => {
          this.plugin.settings.activeContextPath = value || DEFAULT_SETTINGS.activeContextPath;
          await this.plugin.saveSettings();
        }),
      );
  }
}

function withVaultContextFrontmatter(content) {
  if (content.trimStart().startsWith("---")) {
    const start = content.indexOf("---");
    const end = content.indexOf("\n---", start + 3);
    if (end > start) {
      let frontmatter = content.slice(start + 4, end);
      for (const [key, value] of [
        ["ma_records_as", "vault_context"],
        ["ma_project", "Meta-Architect"],
      ]) {
        const pattern = new RegExp(`^${key}:.*$`, "m");
        frontmatter = pattern.test(frontmatter)
          ? frontmatter.replace(pattern, `${key}: ${value}`)
          : `${key}: ${value}\n${frontmatter}`;
      }
      return `---\n${frontmatter}\n---${content.slice(end + 4)}`;
    }
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
  const raw = String(targetPath || "")
    .replaceAll("\\", "/")
    .replace(/^\/+/, "");
  if (raw === ".." || raw.startsWith("../") || raw.includes("/../")) {
    throw new Error("path_traversal_forbidden");
  }
  const normalized = pathNormalize(raw);
  if (
    !normalized ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../")
  ) {
    throw new Error("path_traversal_forbidden");
  }
  if ([".obsidian/", ".trash/", ".git/"].some((prefix) => normalized.startsWith(prefix))) {
    throw new Error("vault_control_path_forbidden");
  }
  for (const forbidden of FORBIDDEN_TARGETS) {
    if (normalized === forbidden || normalized.startsWith(forbidden)) {
      throw new Error(`forbidden_authoritative_mutation:${forbidden}`);
    }
  }
}

function assertMaOwnedPath(targetPath, prefix) {
  const normalized = pathNormalize(String(targetPath || "").replaceAll("\\", "/"));
  if (!normalized.startsWith(prefix)) throw new Error(`ma_owned_path_required:${prefix}`);
}

function pathNormalize(value) {
  const parts = [];
  for (const part of value.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return parts.join("/");
}

function hasVaultContextAuthority(params, settings) {
  const requiredAuthority = settings.protocolAuthority || "vault_context";
  return params?.authority === requiredAuthority;
}

function tokenHash(value) {
  return createHash("sha256")
    .update(String(value || ""))
    .digest("hex");
}

function hasProtocolAuthority(params, settings) {
  return (
    Boolean(settings.protocolToken) &&
    (params?.protocol_token === settings.protocolToken ||
      params?.protocol_token_hash === tokenHash(settings.protocolToken)) &&
    hasVaultContextAuthority(params, settings)
  );
}
