import assert from "node:assert/strict";
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
import { parseSseEvent } from "../src/mcp-live-client.js";
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
