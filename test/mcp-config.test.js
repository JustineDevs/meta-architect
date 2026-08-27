import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  getSupportedLocalCapabilities,
  isValidGitMcpEndpoint,
  loadLocalCapabilities,
  loadMcpServers,
  resolveLocalCapabilityModulePath,
  validateLocalCapabilities,
  validateMcpServers,
} from "../src/mcp-config.js";
import {
  createMcpLiveClient,
  getMcpBridgeConfiguration,
  McpRemoteTransportRequiredError,
  McpStdioBridgeClient,
  mcpClientVersion,
  parseSseEvent,
  resolveMcpClientVersion,
} from "../src/mcp-live-client.js";
import { createTempRepo } from "./helpers/temp-repo.js";

const repoRoot = process.cwd();

async function withTempMcpRepo(run) {
  const tempRoot = await createTempRepo("meta-architect-mcp-", repoRoot);
  const previousRoot = process.env.MA_ROOT;
  process.env.MA_ROOT = tempRoot;

  try {
    return await run(tempRoot);
  } finally {
    if (previousRoot === undefined) {
      delete process.env.MA_ROOT;
    } else {
      process.env.MA_ROOT = previousRoot;
    }
  }
}

test("validates exact GitMCP repo endpoints and docs fallback", () => {
  assert.equal(isValidGitMcpEndpoint("https://gitmcp.io/sindresorhus/awesome"), true);
  assert.equal(isValidGitMcpEndpoint("https://gitmcp.io/docs"), false);
  assert.equal(isValidGitMcpEndpoint("https://example.com/not-gitmcp"), false);
});

test("MCP client version comes from package metadata with a development fallback", async () => {
  assert.equal(resolveMcpClientVersion({ version: "9.8.7" }), "9.8.7");
  assert.equal(resolveMcpClientVersion({}), "0.0.0-dev");
  const packageMetadata = JSON.parse(
    await fs.readFile(path.join(repoRoot, "package.json"), "utf8"),
  );
  assert.equal(mcpClientVersion, packageMetadata.version);
});

test("bundled local capabilities load only the supported first-party set", async () => {
  const loaded = await loadLocalCapabilities();
  const validated = await validateLocalCapabilities();
  const capabilityNames = loaded.capabilities.map((descriptor) => descriptor.capability);

  assert.deepEqual(capabilityNames, getSupportedLocalCapabilities());
  assert.deepEqual(validated, loaded);
  assert.equal(capabilityNames.includes("meta-architect"), false);
});

test("parses SSE endpoint events", () => {
  const parsed = parseSseEvent("event: endpoint\ndata: /*/message?sessionId=abc123\n");
  assert.equal(parsed.event, "endpoint");
  assert.equal(parsed.data, "/*/message?sessionId=abc123");
});

test("reports GitMCP direct SSE 405 as bridge-required instead of generic verification", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed" },
        id: null,
      }),
      { status: 405 },
    );

  try {
    const client = createMcpLiveClient("https://gitmcp.io/obsidianmd/obsidian-api");
    await assert.rejects(
      () => client.connect(),
      (error) => {
        assert.equal(error instanceof McpRemoteTransportRequiredError, true);
        assert.match(error.message, /MA_MCP_REMOTE_BRIDGE_CMD/);
        assert.match(error.message, /HTTP 405/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("uses configured remote bridge command for live MCP request flow", async () => {
  const spawned = [];
  const messages = [];
  const fakeSpawn = (command, args, options = {}) => {
    const entry = { command, args, env: options.env ?? null };
    spawned.push(entry);
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdout.setEncoding = () => {};
    child.stderr.setEncoding = () => {};
    child.stdin = {
      writable: true,
      end: () => {},
      write: (line) => {
        const message = JSON.parse(line);
        messages.push(message);
        if (!message.id) return;

        const results = {
          initialize: { serverInfo: { name: "mock-gitmcp", version: "1.0.0" } },
          "tools/list": { tools: [{ name: "search_obsidian_documentation" }] },
          "tools/call": {
            content: [{ type: "text", text: "Obsidian Plugin API evidence" }],
          },
        };
        queueMicrotask(() => {
          child.stdout.emit(
            "data",
            `${JSON.stringify({ jsonrpc: "2.0", id: message.id, result: results[message.method] })}\n`,
          );
        });
      },
    };
    child.kill = () => {
      queueMicrotask(() => child.emit("exit", 0, null));
      return true;
    };
    return child;
  };

  const client = new McpStdioBridgeClient(
    "https://gitmcp.io/obsidianmd/obsidian-api",
    "trusted-bridge --endpoint {url}",
    fakeSpawn,
    { allowedCommands: ["trusted-bridge"] },
  );
  const previousSecret = process.env.MA_TEST_SECRET;
  process.env.MA_TEST_SECRET = "should-not-leak";
  const init = await client.connect();
  const tools = await client.request("tools/list", {});
  const evidence = await client.request("tools/call", {
    name: tools.tools[0].name,
    arguments: { query: "obsidian plugin" },
  });
  await client.close();
  if (previousSecret === undefined) {
    delete process.env.MA_TEST_SECRET;
  } else {
    process.env.MA_TEST_SECRET = previousSecret;
  }

  assert.deepEqual(spawned[0].command, "trusted-bridge");
  assert.deepEqual(spawned[0].args, ["--endpoint", "https://gitmcp.io/obsidianmd/obsidian-api"]);
  assert.equal(spawned[0].env.MA_TEST_SECRET, undefined);
  assert.equal(typeof spawned[0].env.PATH, "string");
  assert.equal(
    messages.find((message) => message.method === "initialize").params.clientInfo.version,
    mcpClientVersion,
  );
  assert.equal(init.serverInfo.name, "mock-gitmcp");
  assert.equal(tools.tools[0].name, "search_obsidian_documentation");
  assert.equal(evidence.content[0].text, "Obsidian Plugin API evidence");
});

test("remote bridge commands fail closed unless explicitly allowlisted", async () => {
  const client = new McpStdioBridgeClient(
    "https://gitmcp.io/obsidianmd/obsidian-api",
    "untrusted-bridge {url}",
    () => {
      throw new Error("spawn must not run");
    },
    { allowedCommands: ["trusted-bridge"] },
  );
  await assert.rejects(() => client.connect(), /command is not allowlisted/);
});

test("project bridge policy contributes allowlisted commands", async () => {
  await withTempMcpRepo(async (tempRoot) => {
    await fs.writeFile(
      path.join(tempRoot, "mcp", "bridge.json"),
      JSON.stringify({ allowedCommands: ["project-bridge"] }),
    );
    const previous = process.env.MA_MCP_REMOTE_BRIDGE_ALLOWLIST;
    delete process.env.MA_MCP_REMOTE_BRIDGE_ALLOWLIST;
    try {
      const policy = getMcpBridgeConfiguration(tempRoot);
      assert.deepEqual(policy.allowedCommands, ["project-bridge"]);
      assert.equal(policy.source, "environment+project");
    } finally {
      if (previous === undefined) delete process.env.MA_MCP_REMOTE_BRIDGE_ALLOWLIST;
      else process.env.MA_MCP_REMOTE_BRIDGE_ALLOWLIST = previous;
    }
  });
});

test("remote bridge request timeout is configurable for bounded smoke runs", async () => {
  const previousTimeout = process.env.MA_MCP_REQUEST_TIMEOUT_MS;
  process.env.MA_MCP_REQUEST_TIMEOUT_MS = "50";
  const fakeSpawn = () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdout.setEncoding = () => {};
    child.stderr.setEncoding = () => {};
    child.stdin = {
      writable: true,
      end: () => {},
      write: () => {},
    };
    child.kill = () => {
      queueMicrotask(() => child.emit("exit", 0, null));
      return true;
    };
    return child;
  };

  try {
    const client = new McpStdioBridgeClient(
      "https://gitmcp.io/obsidianmd/obsidian-api",
      "trusted-bridge {url}",
      fakeSpawn,
      { allowedCommands: ["trusted-bridge"] },
    );

    await assert.rejects(
      () => client.connect(),
      /Timed out waiting for MCP bridge response to initialize/,
    );
    await client.close();
  } finally {
    if (previousTimeout === undefined) {
      delete process.env.MA_MCP_REQUEST_TIMEOUT_MS;
    } else {
      process.env.MA_MCP_REQUEST_TIMEOUT_MS = previousTimeout;
    }
  }
});

test("validates mcp servers when local capabilities manifest exists alongside them", async () => {
  await withTempMcpRepo(async (tempRoot) => {
    await fs.writeFile(
      path.join(tempRoot, "mcp", "servers.json"),
      `${JSON.stringify(
        {
          schemaVersion: "0.1.0",
          servers: [
            {
              kind: "gitmcp-evidence",
              category: "meta-list",
              repo: "sindresorhus/awesome",
              endpoint: "https://gitmcp.io/sindresorhus/awesome",
            },
          ],
        },
        null,
        2,
      )}\n`,
    );
    await fs.writeFile(
      path.join(tempRoot, "mcp", "local-capabilities.json"),
      `${JSON.stringify(
        {
          schemaVersion: "0.1.0",
          capabilities: [
            {
              kind: "local-capability",
              capability: "_state",
              transport: "inproc",
              module: "./local/state.js",
              readinessCheck: "checkStateCapability",
              seededByBootstrap: true,
            },
            {
              kind: "local-capability",
              capability: "memory",
              transport: "inproc",
              module: "./local/memory.js",
              readinessCheck: "checkMemoryCapability",
              seededByBootstrap: true,
            },
            {
              kind: "local-capability",
              capability: "trace",
              transport: "inproc",
              module: "./local/trace.js",
              readinessCheck: "checkTraceCapability",
              seededByBootstrap: true,
            },
            {
              kind: "local-capability",
              capability: "team_run",
              transport: "inproc",
              module: "./local/team-run.js",
              readinessCheck: "checkTeamRunCapability",
              seededByBootstrap: true,
            },
            {
              kind: "local-capability",
              capability: "code_intel",
              transport: "inproc",
              module: "./local/code-intel.js",
              readinessCheck: "checkCodeIntelCapability",
              seededByBootstrap: true,
            },
          ],
        },
        null,
        2,
      )}\n`,
    );

    const loaded = await loadMcpServers();
    const validated = await validateMcpServers();
    assert.equal(loaded.servers.length, 1);
    assert.deepEqual(validated, loaded);
  });
});

test("does not let local capabilities manifest mask an invalid servers schema", async () => {
  await withTempMcpRepo(async (tempRoot) => {
    await fs.writeFile(
      path.join(tempRoot, "mcp", "servers.json"),
      `${JSON.stringify({ schemaVersion: "0.1.0", servers: {} }, null, 2)}\n`,
    );
    await fs.writeFile(
      path.join(tempRoot, "mcp", "local-capabilities.json"),
      `${JSON.stringify({ schemaVersion: "0.1.0", capabilities: [] }, null, 2)}\n`,
    );

    await assert.rejects(
      () => loadMcpServers(),
      /mcp\/servers\.json must be an object with a servers array/,
    );
  });
});

test("rejects local capability absolute or escaping module paths", async () => {
  assert.throws(
    () =>
      resolveLocalCapabilityModulePath({
        capability: "_state",
        module: "/tmp/escape.js",
      }),
    /cannot use an absolute module path/,
  );
  assert.throws(
    () =>
      resolveLocalCapabilityModulePath({
        capability: "_state",
        module: "../escape.js",
      }),
    /must resolve inside bundled mcp\/local/,
  );
});
