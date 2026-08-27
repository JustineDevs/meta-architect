import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  createDiscoveredEnvironmentAwarenessCore,
  discoverEnvironmentCapabilities,
  selectEnvironmentCapabilitiesForTask,
  validateEnvironmentAwarenessCore,
} from "../src/runtime/environment-awareness-core.js";
import { createTestNamespace, removeTestNamespace } from "../src/test-fixtures.js";

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

test("Environment Awareness discovers repo skills, MCP servers, and plugin manifests safely", async (t) => {
  const root = createTestNamespace("ma-env-awareness");
  t.after(() => removeTestNamespace(root));
  await fs.mkdir(path.join(root, ".agents", "skills", "outside-helper"), { recursive: true });
  await fs.writeFile(
    path.join(root, ".agents", "skills", "outside-helper", "SKILL.md"),
    "---\nname: outside-helper\ndescription: existing user skill\n---\n",
  );
  await fs.mkdir(path.join(root, "skills", "maestro"), { recursive: true });
  await fs.writeFile(
    path.join(root, "skills", "maestro", "SKILL.md"),
    "---\nname: maestro\ndescription: MA core\n---\n",
  );
  await writeJson(path.join(root, "mcp", "servers.json"), {
    schemaVersion: "0.1.0",
    servers: [
      {
        kind: "gitmcp-evidence",
        category: "obsidian-api-docs",
        endpoint: "https://gitmcp.io/obsidianmd/obsidian-api",
      },
    ],
  });
  await writeJson(path.join(root, "plugins", "custom-plugin", ".app.json"), {
    name: "custom-plugin",
  });
  await writeJson(path.join(root, "plugins", "meta-architect", ".codex-plugin", "plugin.json"), {
    name: "meta-architect",
  });

  const core = validateEnvironmentAwarenessCore(
    await createDiscoveredEnvironmentAwarenessCore({ cwd: root }),
  );
  const names = core.capabilities.map((capability) => capability.name);

  assert.equal(core.discovery_policy.records_as, "available_capability");
  assert.equal(core.discovery_policy.never_records_as, "build_evidence");
  assert.equal(core.discovery_policy.auto_run_discovered_tools, false);
  assert.equal(names.includes("outside-helper"), true);
  assert.equal(names.includes("maestro"), true);
  assert.equal(names.includes("obsidian-api-docs"), true);
  assert.equal(names.includes("custom-plugin"), true);
  assert.equal(
    core.capabilities.every(
      (capability) =>
        capability.records_as === "available_capability" &&
        capability.never_records_as === "build_evidence" &&
        capability.mutation_allowed === false,
    ),
    true,
  );
});

test("Environment Awareness global scan is opt-in and redacts home paths", async (t) => {
  const root = createTestNamespace("ma-env-awareness-root");
  const home = createTestNamespace("ma-env-awareness-home");
  t.after(() => Promise.all([removeTestNamespace(root), removeTestNamespace(home)]));
  await fs.mkdir(path.join(home, ".codex", "skills", "global-skill"), { recursive: true });
  await fs.writeFile(
    path.join(home, ".codex", "skills", "global-skill", "SKILL.md"),
    "---\nname: global-skill\ndescription: global user skill\n---\n",
  );

  const withoutGlobal = await discoverEnvironmentCapabilities({ cwd: root, home });
  const withGlobal = await discoverEnvironmentCapabilities({
    cwd: root,
    home,
    includeGlobal: true,
  });

  assert.equal(
    withoutGlobal.some((capability) => capability.name === "global-skill"),
    false,
  );
  const globalSkill = withGlobal.find((capability) => capability.name === "global-skill");
  assert.equal(globalSkill.source_scope, "global_user_config");
  assert.equal(globalSkill.source_path.startsWith("~/"), true);
  assert.equal(globalSkill.source_path.includes(home), false);
});

test("Environment Awareness selection is task-relevant and never build evidence", async () => {
  const core = validateEnvironmentAwarenessCore({
    schemaVersion: "0.1.0",
    product: "Meta-Architect",
    purpose: "test",
    discovery_policy: {
      records_as: "available_capability",
      never_records_as: "build_evidence",
      auto_run_discovered_tools: false,
      mutate_discovered_configs: false,
    },
    known_surface_types: ["skill", "mcp_server"],
    capabilities: [
      {
        record_type: "environment_capability",
        name: "obsidian-api-docs",
        capability_type: "mcp_server",
        owner: "repo_local",
        source_scope: "repo_local",
        source_path: "mcp/servers.json",
        entrypoint: "https://gitmcp.io/obsidianmd/obsidian-api",
        confidence: "medium",
        records_as: "available_capability",
        never_records_as: "build_evidence",
        may_use_when: ["task_relevant"],
        use_requires: ["$maestro_or_owning_lane_selection"],
        mutation_allowed: false,
        authority: "$maestro_or_owning_lane",
      },
    ],
  });
  const selected = selectEnvironmentCapabilitiesForTask(
    core,
    "Use Obsidian API docs for vault context",
  );

  assert.equal(selected.selected_count, 1);
  assert.equal(selected.selected[0].name, "obsidian-api-docs");
  assert.equal(selected.records_as, "available_capability");
  assert.equal(selected.never_records_as, "build_evidence");
});
