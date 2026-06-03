import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
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
  assert.equal(harness.binaryWrites.has("Meta-Architect/Attachments/system-context.json"), true);
  assert.equal(rename.method, "FileManager.renameFile");
  assert.equal(harness.renames[0].to, "Architecture/System Renamed.md");
});

test("Obsidian plugin request queue processes approved actions and refuses authoritative mutations", async () => {
  const harness = createFakeObsidianHarness();

  const result = await drainObsidianPluginRequestQueue({
    app: harness.app,
    MarkdownView: harness.MarkdownView,
    queue: [
      { id: "capture", action: "capture_active_note" },
      {
        id: "create",
        action: "create_note",
        note_path: "Meta-Architect/Plugin Context/Queued Context.md",
        content: "# Queued Context\n\nReal vault context from plugin queue.\n",
      },
      { id: "index", action: "index_vault" },
      {
        id: "attach",
        action: "write_attachment",
        path: "Meta-Architect/Attachments/queue-smoke.txt",
        data: "queue smoke",
        content_type: "text/plain",
      },
      {
        id: "release",
        action: "create_note",
        note_path: ".ma/release.json",
        content: "{}",
      },
    ],
  });

  assert.equal(result.processed.length, 4);
  assert.equal(result.refused.length, 1);
  assert.match(result.refused[0].reason, /forbidden_authoritative_mutation/);
  assert.equal(
    harness.contents
      .get("Meta-Architect/Plugin Context/Queued Context.md")
      .includes("ma_records_as: vault_context"),
    true,
  );
  assert.equal(harness.binaryWrites.has("Meta-Architect/Attachments/queue-smoke.txt"), true);
});

test("Obsidian plugin scaffold installs into a real vault plugin directory", async () => {
  const vaultRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ma-obsidian-plugin-vault-"));
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
