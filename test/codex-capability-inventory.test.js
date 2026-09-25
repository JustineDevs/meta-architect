import assert from "node:assert/strict";
import test from "node:test";
import {
  discoverCodexCapabilityInventory,
  selectCodexCapabilitiesForTask,
} from "../src/runtime/codex-capability-inventory.js";

const outputs = {
  "--help": `Usage: codex [OPTIONS] [PROMPT]\n\nCommands:\n  exec       Run Codex non-interactively\n  features   Manage feature flags\n  mcp        Manage MCP servers\nArguments:\n  prompt     Optional prompt`,
  "--version": "codex-cli 0.156.1",
  "features list": "goals stable true\ntool_search_always_defer_mcp_tools experimental true",
  "mcp list": "Name  Command\nlocal-tools  enabled npx local-tools",
  "plugin list": "PLUGIN  STATUS  VERSION  MARKETPLACE\nreview  installed  1.0.0  local",
  "doctor --json": JSON.stringify({
    schemaVersion: "1",
    overallStatus: "ready",
    codexVersion: "codex-cli 0.156.1",
    checks: {},
  }),
};

function fakeRun(_command, args) {
  const key = args.join(" ");
  return {
    status: 0,
    ok: true,
    stdout: outputs[key] ?? "",
    stderr: "",
    error: null,
  };
}

test("inventory discovers native commands, features, MCP, plugins, app-server, and prompt routes", () => {
  const inventory = discoverCodexCapabilityInventory({
    command: "codex",
    cwd: "/tmp/project",
    home: "/tmp/home",
    run: fakeRun,
  });

  assert.equal(inventory.record_type, "codex_capability_inventory");
  assert.equal(inventory.codex.version, "codex-cli 0.156.1");
  assert.equal(inventory.policy.selection_required, true);
  assert.equal(inventory.policy.auto_execute, false);
  assert.equal(inventory.capabilities.find((item) => item.id === "cli.exec").status, "available");
  assert.equal(
    inventory.capabilities.find((item) => item.id === "feature.goals").status,
    "available",
  );
  assert.equal(
    inventory.capabilities.find((item) => item.id === "mcp.local-tools").status,
    "available",
  );
  assert.equal(
    inventory.capabilities.find((item) => item.id === "plugin.review").status,
    "available",
  );
  assert.equal(
    inventory.capabilities.find((item) => item.id === "app_server.turn.start").status,
    "available",
  );
  const recap = inventory.capabilities.find((item) => item.id === "session.recap");
  assert.equal(recap.status, "available");
  assert.equal(recap.metadata.direct_cli_subcommand, false);
  assert.equal(recap.metadata.native_cli_command, "exec");
});

test("selection chooses recap and preserves the available-capability boundary", () => {
  const inventory = discoverCodexCapabilityInventory({ run: fakeRun });
  const selection = selectCodexCapabilitiesForTask(
    inventory,
    "recap the current session and summarize the blockers",
  );
  const recap = selection.selected.find((item) => item.id === "session.recap");

  assert.ok(recap);
  assert.equal(
    selection.selected.some((item) => item.id === "session.goal"),
    false,
  );
  assert.equal(selection.authority, "$maestro");
  assert.equal(selection.records_as, "available_capability_selection");
  assert.equal(selection.never_records_as, "build_evidence");
  assert.equal(recap.metadata.direct_cli_subcommand, false);
});
