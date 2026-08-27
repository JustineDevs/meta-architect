import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { createTestNamespace, removeTestNamespace } from "../src/test-fixtures.js";

const require = createRequire(import.meta.url);
const installedAgentCompat = require("@jstn-sdk/agents/package.json");

import {
  agentCompatPackage,
  agentCompatVersion,
  compileAgentIntegrations,
  detectAgentEnvironments,
  listAgentCompatAdapters,
  validateAgentIntegrations,
} from "../index.js";

test("Meta-Architect consumes the standalone Agent Compat SDK contract", async () => {
  const root = createTestNamespace("meta-agent-compat");
  try {
    await fs.mkdir(path.join(root, ".cursor"));

    assert.equal(agentCompatPackage, "@jstn-sdk/agents");
    assert.equal(agentCompatVersion, installedAgentCompat.version);
    const adapters = listAgentCompatAdapters();
    for (const id of ["cursor", "claude-code", "claude-desktop", "openclaw", "hermes", "pi"]) {
      assert.equal(
        adapters.some((adapter) => adapter.id === id),
        true,
        id,
      );
    }

    const detected = await detectAgentEnvironments(root);
    assert.equal(
      detected.some((adapter) => adapter.id === "cursor"),
      true,
    );

    const manifest = {
      version: 1,
      project: { name: "meta-architect-consumer", stack: ["javascript"] },
      instructions: ["Run tests before completion"],
    };
    const compiled = await compileAgentIntegrations(manifest, {
      targets: ["generic"],
      output: root,
    });
    assert.equal(compiled.success, true);
    assert.equal(
      compiled.files.some((file) => file.path === "AGENTS.md"),
      true,
    );

    const validation = await validateAgentIntegrations(root, { targets: ["generic"] });
    assert.equal(validation.valid, true);
    assert.equal(validation.results.generic.status, "valid");
  } finally {
    await removeTestNamespace(root);
  }
});
