import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { Agents } from "@jstn-sdk/agents";
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

test("Agent Compat compiles and validates the supported core surfaces", async (t) => {
  const root = createTestNamespace("meta-agent-compat-surfaces");
  t.after(() => removeTestNamespace(root));
  for (const directory of [".cursor", ".claude", ".openclaw", ".pi"]) {
    await fs.mkdir(path.join(root, directory), { recursive: true });
  }

  const targets = [
    "cursor",
    "codex-cli",
    "codex-app",
    "claude-code",
    "claude-desktop",
    "openclaw",
    "hermes",
    "pi",
  ];

  const result = await Agents.compile(
    {
      version: 1,
      project: { name: "surface-conformance", stack: ["typescript"] },
      instructions: ["Run tests before completion"],
      skills: {
        "architecture-review": {
          description: "Review architecture boundaries",
          instructions: ["Inspect the relevant architecture before editing"],
        },
      },
    },
    {
      targets,
      output: root,
      overwrite: true,
    },
  );

  assert.equal(result.success, true);
  assert.deepEqual(result.errors, []);
  for (const expected of [
    ".cursor/rules/agents.mdc",
    "AGENTS.md",
    ".agents/skills/architecture-review/SKILL.md",
    "CLAUDE.md",
    ".claude/skills/architecture-review/SKILL.md",
    "skills/architecture-review/SKILL.md",
    ".pi/skills/architecture-review/SKILL.md",
  ]) {
    await fs.access(path.join(root, expected));
  }

  const report = await Agents.validate(root, { targets });
  assert.equal(report.valid, true);
  assert.deepEqual(report.targets, targets);
  for (const id of targets) {
    assert.ok(report.results[id], `${id} validation result is missing`);
    assert.equal(report.results[id].status, "valid", id);
  }
});
