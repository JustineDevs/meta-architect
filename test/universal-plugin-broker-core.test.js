import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import {
  createDefaultUniversalPluginBrokerCore,
  createUniversalPluginManifest,
  detectInstalledPluginHosts,
  installUniversalPlugin,
  renderPluginContextSkillMd,
  renderUniversalMcpServerTemplate,
  renderWrapperScript,
  rollbackUniversalPluginInstall,
  validateUniversalPluginBrokerCore,
  validateUniversalPluginManifest,
} from "../src/runtime/universal-plugin-broker-core.js";
import { createTestNamespace } from "../src/test-fixtures.js";

const execFileAsync = promisify(execFile);

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function createPluginFixture(t) {
  const root = createTestNamespace("ma-plugin-fixture");
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });
  await fs.mkdir(path.join(root, "dist"), { recursive: true });
  await fs.mkdir(path.join(root, "prompts"), { recursive: true });
  await fs.writeFile(
    path.join(root, "dist", "index.js"),
    "console.log(JSON.stringify({ status: 'success', source: 'fixture' }));\n",
  );
  await fs.writeFile(path.join(root, "prompts", "vet-rules.md"), "# Vet Rules\n\nUse MA gates.\n");
  await writeJson(
    path.join(root, "ma-manifest.json"),
    createUniversalPluginManifest({
      name: "ma-web3-scanner",
      version: "1.4.0",
      description: "AST vulnerability auditing for Solidity files.",
      entrypoint: "dist/index.js",
      mcp: {
        command: "node",
        args: ["{{PLUGIN_DIR}}/dist/index.js"],
      },
      ma_roles: {
        bind: ["$vet", "$sage", "$build"],
        prompt_injection_file: "prompts/vet-rules.md",
      },
    }),
  );
  return root;
}

test("Universal Plugin Broker core defines hybrid MCP and context-layer boundaries", () => {
  const core = validateUniversalPluginBrokerCore(createDefaultUniversalPluginBrokerCore());

  assert.equal(core.architecture.tooling_layer.protocol, "MCP stdio JSON-RPC");
  assert.equal(core.architecture.context_layer.canonical_skill_dir, ".agents/skills");
  assert.equal(core.mcp_injector_hosts.includes("claude-code"), true);
  assert.equal(core.mcp_injector_hosts.includes("antigravity"), true);
  assert.equal(core.mcp_injector_hosts.includes("cursor"), true);
  assert.equal(core.mcp_injector_hosts.includes("codex"), true);
  assert.equal(core.supported_agents.includes("claude-code"), true);
  assert.equal(core.supported_agents.includes("codex"), true);
  assert.equal(core.mutation_policy.may_mutate_release_state, false);
  assert.equal(core.mutation_policy.never_records_as, "build_evidence");
});

test("Universal Plugin Broker validates manifest and renders MCP plus MA skill context", () => {
  const manifest = validateUniversalPluginManifest(
    createUniversalPluginManifest({
      name: "MA Web3 Scanner",
      version: "1.4.0",
      description: "AST vulnerability auditing for Solidity files.",
      entrypoint: "dist/index.js",
      ma_roles: { bind: ["$vet", "$sage"] },
    }),
  );
  const template = renderUniversalMcpServerTemplate();
  const skill = renderPluginContextSkillMd(manifest);

  assert.equal(manifest.name, "ma-web3-scanner");
  assert.equal(manifest.ma_roles.bind.includes("$vet"), true);
  assert.match(template, /StdioServerTransport/);
  assert.match(template, /ListToolsRequestSchema/);
  assert.match(skill, /MCP server name: `ma-plugin-web3-scanner`/);
  assert.match(skill, /Do not mutate `\.ma\/release\.json`/);
  assert.throws(
    () =>
      validateUniversalPluginManifest({
        name: "bad",
        version: "1.0.0",
        entrypoint: "dist/index.js",
        mcp: { command: "node", args: [] },
        ma_roles: { bind: ["vet"] },
      }),
    /role bindings/,
  );
});

test("generated wrapper preserves hostile argv as data", async (t) => {
  const root = createTestNamespace("ma-plugin-wrapper-quoting");
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const entrypoint = path.join(root, "entry;$(touch injected) 'quoted'.mjs");
  const output = path.join(root, "argv.json");
  await fs.writeFile(
    entrypoint,
    "import { writeFileSync } from 'node:fs'; writeFileSync(process.env.OUTPUT, JSON.stringify(process.argv.slice(2)));\n",
  );
  const wrapper = path.join(root, "wrapper.sh");
  const manifest = createUniversalPluginManifest({
    name: "quoting",
    entrypoint: "entry.mjs",
    mcp: {
      command: "node",
      args: [entrypoint, "space;$(touch injected)", "quote'\"`$HOME", "line\nvalue"],
    },
  });
  await fs.writeFile(wrapper, renderWrapperScript({ manifest, pluginDir: root }), { mode: 0o755 });
  await execFileAsync(wrapper, ["caller;$(touch caller-injected)"], {
    env: { ...process.env, OUTPUT: output },
  });
  assert.deepEqual(JSON.parse(await fs.readFile(output, "utf8")), [
    "space;$(touch injected)",
    "quote'\"`$HOME",
    "line\nvalue",
    "caller;$(touch caller-injected)",
  ]);
  assert.equal(
    await fs.access(path.join(root, "injected")).then(
      () => true,
      () => false,
    ),
    false,
  );
  assert.equal(
    await fs.access(path.join(root, "caller-injected")).then(
      () => true,
      () => false,
    ),
    false,
  );
  assert.throws(
    () =>
      renderWrapperScript({
        manifest: { ...manifest, mcp: { command: "node", args: ["bad\0arg"] } },
        pluginDir: root,
      }),
    /NUL bytes/,
  );
});

test("Universal Plugin Broker installs local plugin, injects vendor MCP configs, and exports MA context skill", async (t) => {
  const sourceDir = await createPluginFixture(t);
  const home = createTestNamespace("ma-plugin-home");
  t.after(async () => {
    await fs.rm(home, { recursive: true, force: true });
  });

  await writeJson(path.join(home, ".claude.json"), { existing: true });
  await fs.mkdir(path.join(home, ".antigravity"), { recursive: true });
  await fs.writeFile(path.join(home, ".antigravity", "config.toml"), "# existing agy config\n");
  await fs.mkdir(path.join(home, ".config", "Cursor", "User", "globalStorage"), {
    recursive: true,
  });
  await writeJson(path.join(home, ".config", "Cursor", "User", "globalStorage", "storage.json"), {
    existing: true,
  });
  await fs.mkdir(path.join(home, ".codex"), { recursive: true });
  await fs.writeFile(path.join(home, ".codex", "config.toml"), "# existing codex config\n");

  assert.deepEqual((await detectInstalledPluginHosts({ home })).sort(), [
    "antigravity",
    "claude-code",
    "codex",
    "cursor",
  ]);

  const receipt = await installUniversalPlugin({
    sourceDir,
    home,
    targets: ["claude-code", "antigravity", "cursor", "codex"],
  });
  const repeated = await installUniversalPlugin({
    sourceDir,
    home,
    targets: ["claude-code", "antigravity", "cursor", "codex"],
  });
  const claudeConfig = JSON.parse(await fs.readFile(path.join(home, ".claude.json"), "utf8"));
  const cursorStorage = JSON.parse(
    await fs.readFile(
      path.join(home, ".config", "Cursor", "User", "globalStorage", "storage.json"),
      "utf8",
    ),
  );
  const antigravityToml = await fs.readFile(path.join(home, ".antigravity", "config.toml"), "utf8");
  const codexToml = await fs.readFile(path.join(home, ".codex", "config.toml"), "utf8");
  const wrapperStat = await fs.stat(receipt.wrapperPath);
  const skillMd = await fs.readFile(
    path.join(home, ".agents", "skills", "ma-plugin-web3-scanner", "SKILL.md"),
    "utf8",
  );

  assert.equal(receipt.record_type, "universal_plugin_broker_install_receipt");
  assert.equal(receipt.records_as, "plugin_compatibility_configuration");
  assert.equal(receipt.build_evidence, false);
  assert.equal(receipt.vendorInjection.configured_hosts.length, 4);
  assert.equal(repeated.vendorInjection.configured_hosts.length, 4);
  assert.equal(Boolean(wrapperStat.mode & 0o111), true);
  assert.match(await fs.readFile(receipt.wrapperPath, "utf8"), /exec 'node'/);
  assert.equal(claudeConfig.mcpServers["ma-plugin-web3-scanner"].command, receipt.wrapperPath);
  assert.equal(
    cursorStorage["mcp.mcpServers"]["ma-plugin-web3-scanner"].command,
    receipt.wrapperPath,
  );
  assert.equal((antigravityToml.match(/name = "ma-plugin-web3-scanner"/g) ?? []).length, 1);
  assert.equal((codexToml.match(/\[mcp_servers\."ma-plugin-web3-scanner"\]/g) ?? []).length, 1);
  assert.match(skillMd, /\$vet/);
  assert.match(skillMd, /\$build/);
  assert.match(skillMd, /never as `build_evidence`/);
});

test("Universal Plugin Broker skips absent vendors instead of creating unrelated host config", async (t) => {
  const sourceDir = await createPluginFixture(t);
  const home = createTestNamespace("ma-plugin-empty-home");
  t.after(async () => {
    await fs.rm(home, { recursive: true, force: true });
  });

  const receipt = await installUniversalPlugin({
    sourceDir,
    home,
    targets: ["claude-code", "antigravity", "cursor", "codex"],
  });

  assert.equal(receipt.vendorInjection.configured_hosts.length, 0);
  assert.equal(
    receipt.vendorInjection.receipts.every((entry) => entry.status === "skipped"),
    true,
  );
  assert.equal(
    await fs.readdir(path.join(home, ".agents", "skills")).then((items) => items.length),
    1,
  );
});

test("Universal Plugin Broker refuses symlinked vendor config paths before mutation", async (t) => {
  const sourceDir = await createPluginFixture(t);
  const home = createTestNamespace("ma-plugin-symlink-home");
  const outsideConfig = path.join(home, "outside-config.toml");
  t.after(async () => fs.rm(home, { recursive: true, force: true }));
  await fs.mkdir(path.join(home, ".codex"), { recursive: true });
  await fs.writeFile(outsideConfig, "# original\n");
  await fs.symlink(outsideConfig, path.join(home, ".codex", "config.toml"));

  await assert.rejects(
    installUniversalPlugin({ sourceDir, home, targets: ["codex"] }),
    /symlinked vendor path/,
  );
  assert.equal(await fs.readFile(outsideConfig, "utf8"), "# original\n");
  assert.equal(
    await fs.access(path.join(home, ".ma", "plugins", "ma-web3-scanner")).then(
      () => true,
      () => false,
    ),
    false,
  );
});

test("Universal Plugin Broker previews and rolls back vendor MCP mutations", async (t) => {
  const sourceDir = await createPluginFixture(t);
  const home = createTestNamespace("ma-plugin-rollback-home");
  t.after(async () => {
    await fs.rm(home, { recursive: true, force: true });
  });
  await fs.mkdir(path.join(home, ".codex"), { recursive: true });
  await fs.writeFile(path.join(home, ".codex", "config.toml"), "# original\n");

  const preview = await installUniversalPlugin({
    sourceDir,
    home,
    targets: ["codex"],
    dryRun: true,
  });
  assert.equal(preview.record_type, "universal_plugin_broker_dry_run");
  assert.deepEqual(preview.files, [path.join(home, ".codex", "config.toml")]);
  assert.equal(await fs.readFile(path.join(home, ".codex", "config.toml"), "utf8"), "# original\n");
  assert.equal(
    await fs.access(path.join(home, ".ma", "plugins")).then(
      () => true,
      () => false,
    ),
    false,
  );

  const receipt = await installUniversalPlugin({ sourceDir, home, targets: ["codex"] });
  assert.equal(await fs.stat(path.join(receipt.backupRoot, "receipt.json")).then(() => true), true);
  assert.equal(receipt.vendorInjection.receipts[0].beforeHash !== null, true);
  assert.equal(
    receipt.vendorInjection.receipts[0].afterHash !==
      receipt.vendorInjection.receipts[0].beforeHash,
    true,
  );
  await rollbackUniversalPluginInstall(receipt);
  assert.equal(await fs.readFile(path.join(home, ".codex", "config.toml"), "utf8"), "# original\n");
});
