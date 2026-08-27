import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  applyObsidianFrontmatterAuthority,
  createDefaultObsidianPluginBridgeManifest,
  createObsidianMetadataGraph,
  createObsidianSelectionContext,
  drainObsidianPluginRequestQueue,
  extractObsidianCanvasContext,
  generateObsidianMarkdownLink,
  installObsidianPlugin,
  registerMetaArchitectObsidianPluginRuntime,
  renameObsidianFileSafely,
  writeObsidianAttachment,
} from "../src/runtime/obsidian-plugin-bridge.js";
import { createTestNamespace } from "../src/test-fixtures.js";

test("Obsidian plugin bridge manifest makes all 10 capabilities core vault_context", () => {
  const manifest = createDefaultObsidianPluginBridgeManifest();
  const capabilities = manifest.capabilities.map((entry) => entry.capability);

  assert.equal(manifest.plugin_id, "meta-architect");
  assert.equal(manifest.records_as, "vault_context");
  assert.equal(manifest.build_evidence, false);
  assert.deepEqual(capabilities, [
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
  ]);
  assert.equal(manifest.authority_boundary.must_not_mutate.includes(".ma/release.json"), true);
});

test("Obsidian plugin runtime registers in-app actions, protocol handlers, and watchers", async () => {
  const harness = createFakeObsidianHarness();

  const registration = await registerMetaArchitectObsidianPluginRuntime({
    plugin: harness.plugin,
    app: harness.app,
    Notice: harness.Notice,
    Modal: harness.Modal,
    PluginSettingTab: harness.PluginSettingTab,
    Setting: harness.Setting,
    MarkdownView: harness.MarkdownView,
  });

  assert.equal(registration.ribbon, true);
  assert.equal(registration.status_bar, true);
  assert.equal(registration.settings_tab, true);
  assert.equal(registration.protocol.registered, true);
  assert.equal(registration.watchers.registered_count >= 9, true);
  assert.deepEqual(harness.plugin.commands.map((command) => command.id).sort(), [
    "ma-capture-active-note",
    "ma-drain-request-queue",
    "ma-open-map",
  ]);
  assert.equal(harness.plugin.protocolHandlers.has("ma"), true);
  assert.equal(harness.plugin.registeredEvents.length >= 9, true);
});

test("Obsidian app APIs provide real active note, metadata graph, frontmatter, links, canvas, and binary context", async () => {
  const harness = createFakeObsidianHarness();
  const activeFile = harness.files.get("Architecture/System.md");

  const selection = createObsidianSelectionContext({
    app: harness.app,
    MarkdownView: harness.MarkdownView,
  });
  const graph = createObsidianMetadataGraph({ app: harness.app });
  const frontmatter = await applyObsidianFrontmatterAuthority({
    app: harness.app,
    file: activeFile,
    sourceWorkspace: "/workspace/project",
  });
  const link = generateObsidianMarkdownLink({
    app: harness.app,
    file: activeFile,
    sourcePath: "Meta-Architect/Plugin Context/Active Note Context.md",
    alias: "active system note",
  });
  const canvas = await extractObsidianCanvasContext({ app: harness.app });
  const attachment = await writeObsidianAttachment({
    app: harness.app,
    attachmentPath: "Meta-Architect/Attachments/system-context.json",
    data: JSON.stringify({ active: activeFile.path }),
    contentType: "application/json",
  });
  const rename = await renameObsidianFileSafely({
    app: harness.app,
    file: activeFile,
    newPath: "Architecture/System Renamed.md",
  });

  assert.equal(selection.active_note_path, "Architecture/System.md");
  assert.equal(selection.selected_text, "selected architecture context");
  assert.deepEqual(selection.cursor, { line: 12, ch: 4 });
  assert.equal(graph.note_count, 2);
  assert.equal(graph.nodes[0].headings.length, 1);
  assert.equal(graph.nodes[0].links[0].link, "Architecture/Decision");
  assert.equal(graph.nodes[0].embeds[0].link, "diagrams/system.png");
  assert.equal(graph.nodes[0].tags[0].tag, "#ma/core");
  assert.equal(graph.nodes[0].blocks.system.position.start.line, 6);
  assert.equal(graph.nodes[0].sections[0].type, "heading");
  assert.equal(harness.frontmatter.get("Architecture/System.md").ma_records_as, "vault_context");
  assert.equal(frontmatter.records_as, "vault_context");
  assert.equal(link.link, "[[Architecture/System|active system note]]");
  assert.equal(canvas.canvas_count, 1);
  assert.equal(canvas.canvases[0].nodes[0].text, "System boundary");
  assert.equal(canvas.canvases[0].edges[0].fromNode, "a");
  assert.equal(attachment.byte_length > 0, true);
  assert.equal(attachment.request_id, null);
  assert.equal(attachment.source_action, null);
  assert.equal(harness.binaryWrites.has("Meta-Architect/Attachments/system-context.json"), true);
  assert.equal(rename.method, "FileManager.renameFile");
  assert.equal(harness.renames[0].to, "Architecture/System Renamed.md");
});

test("Obsidian plugin request queue processes approved actions and refuses authoritative mutations", async () => {
  const harness = createFakeObsidianHarness();

  const result = await drainObsidianPluginRequestQueue({
    app: harness.app,
    MarkdownView: harness.MarkdownView,
    settings: { protocolToken: "test-token" },
    queue: [
      {
        id: "capture",
        action: "capture_active_note",
        authority: "vault_context",
        protocol_token_hash: createHash("sha256").update("test-token").digest("hex"),
      },
      {
        id: "create",
        action: "create_note",
        authority: "vault_context",
        records_as: "vault_context",
        protocol_token: "test-token",
        note_path: "Meta-Architect/Plugin Context/Queued Context.md",
        content: "# Queued Context\n\nReal vault context from plugin queue.\n",
      },
      { id: "index", action: "index_vault" },
      {
        id: "attach",
        action: "write_attachment",
        authority: "vault_context",
        records_as: "vault_context",
        protocol_token: "test-token",
        path: "Meta-Architect/Attachments/queue-smoke.txt",
        data: "queue smoke",
        content_type: "text/plain",
      },
      {
        id: "release",
        action: "create_note",
        records_as: "vault_context",
        protocol_token: "test-token",
        note_path: ".ma/release.json",
        content: "{}",
      },
    ],
  });

  assert.equal(result.processed.length, 4);
  assert.equal(result.refused.length, 1);
  assert.equal(result.refusedQueueItems.length, 1);
  assert.equal(result.refusedQueueItems[0].queue_status, "refused");
  assert.equal(result.refusedQueueItems[0].attempts, 1);
  assert.match(
    result.refusedQueueItems[0].refusal_reason,
    /obsidian_queue_authority_required|forbidden_authoritative_mutation/,
  );
  assert.match(
    result.refused[0].reason,
    /obsidian_queue_authority_required|forbidden_authoritative_mutation/,
  );
  assert.equal(
    harness.contents
      .get("Meta-Architect/Plugin Context/Queued Context.md")
      .includes("ma_records_as: vault_context"),
    true,
  );
  assert.equal(harness.binaryWrites.has("Meta-Architect/Attachments/queue-smoke.txt"), true);
});

test("Obsidian protocol queue actions require explicit authority and keep refused items queued", async () => {
  const harness = createFakeObsidianHarness();
  const registration = await registerMetaArchitectObsidianPluginRuntime({
    plugin: harness.plugin,
    app: harness.app,
    MarkdownView: harness.MarkdownView,
    settings: {
      queuePath: "Meta-Architect/Plugin Requests/request-queue.json",
      protocolAuthority: "vault_context",
      protocolToken: "test-token",
    },
  });

  const protocol = harness.plugin.protocolHandlers.get(registration.protocol.handler);
  await assert.rejects(() => protocol({ action: "queue", path: "Meta-Architect/Queued.md" }));
  const receipt = await protocol({
    action: "queue",
    protocol_token: "test-token",
    authority: "vault_context",
    records_as: "vault_context",
    path: "Meta-Architect/Queued.md",
    note_path: "Meta-Architect/Queued.md",
  });
  assert.equal(receipt.record_type, "obsidian_protocol_action");
  assert.equal(receipt.status, "accepted");
  await harness.plugin.commands
    .find((command) => command.id === "ma-drain-request-queue")
    .callback();

  const queue = JSON.parse(
    harness.contents.get("Meta-Architect/Plugin Requests/request-queue.json"),
  );
  assert.equal(queue.length, 1);
  assert.equal(queue[0].action, "queue");
  assert.equal(queue[0].queue_status, "refused");
  assert.equal(queue[0].attempts, 1);
  assert.equal("protocol_token" in queue[0], false);
  assert.equal(typeof queue[0].protocol_token_hash, "string");

  await harness.plugin.commands
    .find((command) => command.id === "ma-drain-request-queue")
    .callback();
  const retried = JSON.parse(
    harness.contents.get("Meta-Architect/Plugin Requests/request-queue.json"),
  );
  assert.equal(retried.length, 1);
  assert.equal(retried[0].attempts, 2);
});

test("Obsidian protocol rejects unknown fields, oversized payloads, and traversal", async () => {
  const harness = createFakeObsidianHarness();
  const registration = await registerMetaArchitectObsidianPluginRuntime({
    plugin: harness.plugin,
    app: harness.app,
    settings: { protocolAuthority: "vault_context", protocolToken: "test-token" },
  });
  const protocol = harness.plugin.protocolHandlers.get(registration.protocol.handler);
  const trusted = { protocol_token: "test-token", authority: "vault_context" };
  await assert.rejects(
    () => protocol({ ...trusted, action: "queue", path: "Meta-Architect/ok.md", unknown: true }),
    /field_forbidden/,
  );
  await assert.rejects(
    () =>
      protocol({
        ...trusted,
        action: "queue",
        path: "Meta-Architect/ok.md",
        content: "x".repeat(70 * 1024),
      }),
    /payload_too_large/,
  );
  await assert.rejects(
    () => protocol({ ...trusted, action: "queue", path: "Meta-Architect/../.ma/release.json" }),
    /path_traversal_forbidden/,
  );
  await assert.rejects(() => protocol({ ...trusted, action: "unknown" }), /action_forbidden/);
});

test("Obsidian queue drain leaves malformed JSON untouched", async () => {
  const harness = createFakeObsidianHarness();
  const queuePath = "Meta-Architect/Plugin Requests/request-queue.json";
  harness.files.set(queuePath, createFile(queuePath));
  harness.contents.set(queuePath, "{ malformed");
  await registerMetaArchitectObsidianPluginRuntime({
    plugin: harness.plugin,
    app: harness.app,
    settings: { queuePath, protocolAuthority: "vault_context", protocolToken: "test-token" },
  });
  const drain = harness.plugin.commands.find((command) => command.id === "ma-drain-request-queue");
  await assert.rejects(() => drain.callback(), SyntaxError);
  assert.equal(harness.contents.get(queuePath), "{ malformed");
});

test("Obsidian attachment writes enforce size, type, and overwrite policy", async () => {
  const harness = createFakeObsidianHarness();

  await writeObsidianAttachment({
    app: harness.app,
    attachmentPath: "Meta-Architect/Attachments/policy.txt",
    data: "ok",
    contentType: "text/plain",
  });

  await assert.rejects(
    () =>
      writeObsidianAttachment({
        app: harness.app,
        attachmentPath: "Meta-Architect/Attachments/policy.txt",
        data: "again",
        contentType: "text/plain",
      }),
    /attachment_exists/,
  );

  await assert.rejects(
    () =>
      writeObsidianAttachment({
        app: harness.app,
        attachmentPath: "Meta-Architect/Attachments/policy.bin",
        data: "x".repeat(1_048_577),
        contentType: "application/octet-stream",
      }),
    /attachment_too_large/,
  );

  await assert.rejects(
    () =>
      writeObsidianAttachment({
        app: harness.app,
        attachmentPath: "Meta-Architect/Attachments/policy.exe",
        data: "MZ",
        contentType: "application/x-msdownload",
      }),
    /attachment_type_forbidden/,
  );

  const overwritten = await writeObsidianAttachment({
    app: harness.app,
    attachmentPath: "Meta-Architect/Attachments/policy.txt",
    data: "updated",
    contentType: "text/plain",
    overwrite: true,
    requestId: "attachment-1",
    sourceAction: "write_attachment",
  });
  assert.equal(overwritten.request_id, "attachment-1");
  assert.equal(overwritten.source_action, "write_attachment");
});

test("Obsidian plugin scaffold installs into a real vault plugin directory", async (t) => {
  const vaultRoot = createTestNamespace("ma-obsidian-plugin-vault");
  t.after(() => fs.rm(vaultRoot, { recursive: true, force: true }));
  await fs.mkdir(path.join(vaultRoot, ".obsidian"), { recursive: true });

  const receipt = await installObsidianPlugin({ vaultPath: vaultRoot });
  const manifestPath = path.join(
    vaultRoot,
    ".obsidian",
    "plugins",
    "meta-architect",
    "manifest.json",
  );
  const mainPath = path.join(vaultRoot, ".obsidian", "plugins", "meta-architect", "main.js");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const main = await fs.readFile(mainPath, "utf8");
  const enabled = JSON.parse(
    await fs.readFile(path.join(vaultRoot, ".obsidian", "community-plugins.json"), "utf8"),
  );

  assert.equal(receipt.records_as, "vault_context");
  assert.equal(receipt.build_evidence, false);
  assert.equal(receipt.enabled, true);
  assert.equal(enabled.includes("meta-architect"), true);
  assert.equal(manifest.id, "meta-architect");
  assert.equal(receipt.installed_files.includes("main.js"), true);
  assert.match(main, /addRibbonIcon/);
  assert.match(main, /registerObsidianProtocolHandler/);
  assert.match(main, /processFrontMatter/);
  assert.match(main, /createBinary/);
});

test("Obsidian plugin install refuses a symlinked community plugin config", async (t) => {
  const root = createTestNamespace("ma-obsidian-symlink-config");
  const vaultRoot = path.join(root, "vault");
  const outsideConfig = path.join(root, "outside-community-plugins.json");
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(vaultRoot, ".obsidian"), { recursive: true });
  await fs.writeFile(outsideConfig, "[]\n");
  await fs.symlink(outsideConfig, path.join(vaultRoot, ".obsidian", "community-plugins.json"));

  await assert.rejects(
    installObsidianPlugin({ vaultPath: vaultRoot }),
    /cannot traverse a symlink/,
  );
  assert.equal(await fs.readFile(outsideConfig, "utf8"), "[]\n");
  assert.equal(
    await fs.access(path.join(vaultRoot, ".obsidian", "plugins", "meta-architect")).then(
      () => true,
      () => false,
    ),
    false,
  );
});

function createFakeObsidianHarness() {
  const files = new Map([
    ["Architecture/System.md", createFile("Architecture/System.md")],
    ["Architecture/Decision.md", createFile("Architecture/Decision.md")],
    ["Architecture/System.canvas", createFile("Architecture/System.canvas")],
  ]);
  const folders = new Set(["Architecture"]);
  const contents = new Map([
    ["Architecture/System.md", "# System\n\n[[Architecture/Decision]] #ma/core\n"],
    ["Architecture/Decision.md", "# Decision\n\n#ma/adr\n"],
    [
      "Architecture/System.canvas",
      JSON.stringify({
        nodes: [{ id: "a", type: "text", text: "System boundary" }],
        edges: [{ id: "e1", fromNode: "a", toNode: "a" }],
      }),
    ],
  ]);
  const frontmatter = new Map([["Architecture/System.md", { existing: true }]]);
  const binaryWrites = new Map();
  const renames = [];
  const events = [];

  const vault = {
    getAbstractFileByPath(targetPath) {
      return files.get(targetPath) ?? (folders.has(targetPath) ? { path: targetPath } : null);
    },
    async create(targetPath, content) {
      files.set(targetPath, createFile(targetPath));
      contents.set(targetPath, content);
      return files.get(targetPath);
    },
    async modify(file, content) {
      contents.set(file.path, content);
    },
    async read(file) {
      return contents.get(file.path);
    },
    async createFolder(folderPath) {
      folders.add(folderPath);
    },
    async createBinary(targetPath, data) {
      binaryWrites.set(targetPath, new Uint8Array(data));
      files.set(targetPath, createFile(targetPath));
    },
    adapter: {
      async writeBinary(targetPath, data) {
        binaryWrites.set(targetPath, new Uint8Array(data));
      },
    },
    on(eventName, callback) {
      const event = { source: "vault", eventName, callback };
      events.push(event);
      return event;
    },
  };

  const metadataCache = {
    resolvedLinks: {
      "Architecture/System.md": { "Architecture/Decision.md": 1 },
    },
    unresolvedLinks: {
      "Architecture/System.md": { "Missing.md": 1 },
    },
    getCachedFiles() {
      return [...files.keys()];
    },
    getFileCache(file) {
      if (file.path !== "Architecture/System.md") {
        return { frontmatter: {}, headings: [], links: [], embeds: [], tags: [] };
      }
      return {
        frontmatter: frontmatter.get(file.path),
        headings: [{ heading: "System", level: 1, position: { start: { line: 0 } } }],
        links: [{ link: "Architecture/Decision", original: "[[Architecture/Decision]]" }],
        embeds: [{ link: "diagrams/system.png", original: "![[diagrams/system.png]]" }],
        tags: [{ tag: "#ma/core", position: { start: { line: 2 } } }],
        blocks: { system: { position: { start: { line: 6 } } } },
        sections: [{ type: "heading", position: { start: { line: 0 } } }],
      };
    },
    on(eventName, callback) {
      const event = { source: "metadataCache", eventName, callback };
      events.push(event);
      return event;
    },
  };

  const editor = {
    getSelection() {
      return "selected architecture context";
    },
    getCursor() {
      return { line: 12, ch: 4 };
    },
  };
  class MarkdownView {}
  const activeView = new MarkdownView();
  activeView.editor = editor;
  activeView.getViewType = () => "markdown";
  const activeLeaf = {
    view: activeView,
    getViewState() {
      return { type: "markdown", state: { mode: "source" } };
    },
  };

  const workspace = {
    activeLeaf,
    getActiveFile() {
      return files.get("Architecture/System.md");
    },
    getActiveViewOfType(Type) {
      return Type === MarkdownView ? activeView : null;
    },
    getLeaf() {
      return {
        async openFile(file) {
          this.opened = file.path;
        },
      };
    },
    on(eventName, callback) {
      const event = { source: "workspace", eventName, callback };
      events.push(event);
      return event;
    },
  };

  const app = {
    vault,
    metadataCache,
    workspace,
    fileManager: {
      async processFrontMatter(file, mutate) {
        const current = frontmatter.get(file.path) ?? {};
        mutate(current);
        frontmatter.set(file.path, current);
      },
      async renameFile(file, newPath) {
        renames.push({ from: file.path, to: newPath });
        files.delete(file.path);
        files.set(newPath, { ...file, path: newPath, basename: path.basename(newPath, ".md") });
      },
      generateMarkdownLink(file, _sourcePath, _subpath, alias) {
        const target = file.path.replace(/\.md$/i, "");
        return `[[${target}${alias ? `|${alias}` : ""}]]`;
      },
    },
  };

  const plugin = {
    app,
    commands: [],
    registeredEvents: [],
    protocolHandlers: new Map(),
    addRibbonIcon(icon, title, callback) {
      this.ribbon = { icon, title, callback };
    },
    addStatusBarItem() {
      return {
        text: "",
        setText(text) {
          this.text = text;
        },
      };
    },
    addCommand(command) {
      this.commands.push(command);
    },
    addSettingTab(tab) {
      this.settingTab = tab;
    },
    registerObsidianProtocolHandler(handler, callback) {
      this.protocolHandlers.set(handler, callback);
    },
    registerEvent(event) {
      this.registeredEvents.push(event);
    },
  };

  class Modal {}
  class PluginSettingTab {
    constructor(appArg, pluginArg) {
      this.app = appArg;
      this.plugin = pluginArg;
      this.containerEl = {
        empty() {},
        createEl() {},
      };
    }
  }
  class Setting {
    setName() {
      return this;
    }
    setDesc() {
      return this;
    }
    addText() {
      return this;
    }
  }
  class Notice {
    constructor(message) {
      this.message = message;
    }
  }

  return {
    app,
    binaryWrites,
    contents,
    events,
    files,
    frontmatter,
    MarkdownView,
    Modal,
    Notice,
    plugin,
    PluginSettingTab,
    renames,
    Setting,
  };
}

function createFile(filePath) {
  return {
    path: filePath,
    basename: path.basename(filePath, path.extname(filePath)),
    extension: path.extname(filePath).slice(1),
  };
}
