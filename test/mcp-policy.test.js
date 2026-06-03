import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { createTempRepo } from "./helpers/temp-repo.js";

const repoRoot = process.cwd();

test("runtime-local MCP policy may only narrow repo-owned manifests", async () => {
  const { validateRuntimeMcpPolicy } = await import("../src/runtime/mcp-policy.js");
  const localCapabilities = {
    capabilities: [{ capability: "_state" }, { capability: "trace" }],
  };
  const servers = {
    servers: [{ endpoint: "https://gitmcp.io/obsidianmd/obsidian-api" }],
  };

  const validFindings = validateRuntimeMcpPolicy({
    policy: {
      schemaVersion: "0.1.0",
      executionMode: "READ_ONLY",
      capabilities: [{ capability: "_state", executionMode: "READ_ONLY" }],
      evidenceSources: ["https://gitmcp.io/obsidianmd/obsidian-api"],
      allowedPaths: ["mcp/servers.json", ".ma/context"],
      envAllowlist: ["MA_ROOT"],
    },
    localCapabilities,
    servers,
    activeProfile: "project",
  });
  assert.deepEqual(validFindings, []);

  const invalidFindings = validateRuntimeMcpPolicy({
    policy: {
      executionMode: "HOST_MUTABLE",
      capabilities: [
        { capability: "unknown", module: "../escape.js", executionMode: "SANDBOX_MUTABLE" },
      ],
      evidenceSources: ["https://gitmcp.io/docs"],
      allowedPaths: ["/tmp"],
      envAllowlist: ["*"],
    },
    localCapabilities,
    servers,
    activeProfile: "deep",
    sourcePath: ".ma/.mcp.json",
  });

  assert.equal(
    invalidFindings.every((finding) => finding.record_type === "policy:mcp_validation"),
    true,
  );
  assert.equal(
    invalidFindings.some((finding) => /HOST_MUTABLE/.test(finding.diagnostic)),
    true,
  );
  assert.equal(
    invalidFindings.some((finding) => /unsupported capability/.test(finding.diagnostic)),
    true,
  );
  assert.equal(
    invalidFindings.some((finding) => /unsafe module path/.test(finding.diagnostic)),
    true,
  );
  assert.equal(
    invalidFindings.some((finding) => /unapproved evidence source/.test(finding.diagnostic)),
    true,
  );
  assert.equal(
    invalidFindings.some((finding) => /wildcard env access/.test(finding.recommended_action)),
    true,
  );
});

test("exposure profile includes runtime-local MCP policy findings without mutating release state", async () => {
  const tempRoot = await createTempRepo("meta-architect-mcp-policy-", repoRoot);
  const previousRoot = process.env.MA_ROOT;
  process.env.MA_ROOT = tempRoot;

  try {
    await fs.mkdir(path.join(tempRoot, ".ma"), { recursive: true });
    await fs.writeFile(
      path.join(tempRoot, ".ma", ".mcp.json"),
      `${JSON.stringify(
        {
          schemaVersion: "0.1.0",
          executionMode: "SANDBOX_MUTABLE",
          capabilities: [{ capability: "_state", executionMode: "SANDBOX_MUTABLE" }],
        },
        null,
        2,
      )}\n`,
    );

    const exposureCatalog = await import(
      `${pathToFileURL(path.join(repoRoot, "src", "runtime", "exposure-catalog.js")).href}?t=${Date.now()}`
    );
    const report = await exposureCatalog.scanExposureProfile("project");

    assert.equal(report.read_only, true);
    assert.equal(report.mutates_release_state, false);
    assert.equal(report.scanned_surfaces.includes(".ma/.mcp.json"), true);
    assert.equal(
      report.findings.some(
        (finding) =>
          finding.record_type === "policy:mcp_validation" &&
          /SANDBOX_MUTABLE/.test(finding.diagnostic),
      ),
      true,
    );
  } finally {
    if (previousRoot === undefined) {
      delete process.env.MA_ROOT;
    } else {
      process.env.MA_ROOT = previousRoot;
    }
  }
});
