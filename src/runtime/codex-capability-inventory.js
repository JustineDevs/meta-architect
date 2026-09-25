import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { writeJson } from "../fs-utils.js";
import { getRuntimeSubsystemPath } from "../paths.js";
import { safeSpawnSync } from "../process-utils.js";

export const codexCapabilityInventorySchemaVersion = "0.1.0";

export function getCodexCapabilityInventoryPath() {
  return getRuntimeSubsystemPath("context", "codex-capability-inventory.json");
}

const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const nonCommandWords = new Set([
  "a",
  "an",
  "and",
  "for",
  "if",
  "or",
  "the",
  "this",
  "to",
  "use",
  "when",
  "with",
]);

const appServerMethods = [
  "initialize",
  "thread/start",
  "thread/resume",
  "thread/fork",
  "thread/list",
  "thread/archive",
  "turn/start",
  "turn/interrupt",
  "config/read",
  "config/batchWrite",
];

const commandAliases = {
  recap: ["recap", "summary", "summarize", "context", "handoff", "compact"],
  goals: ["goal", "goals", "milestone", "objective"],
  sessions: ["session", "thread", "resume", "fork", "archive", "conversation"],
  mcp: ["mcp", "tool", "server", "integration"],
  plugins: ["plugin", "marketplace", "extension", "skill"],
  features: ["feature", "flag", "capability", "runtime"],
  verification: ["doctor", "diagnose", "health", "verify", "check"],
  execution: ["exec", "run", "implement", "test", "command"],
  review: ["review", "audit", "inspect", "security"],
  sandbox: ["sandbox", "permission", "approval", "isolation"],
};

const promptCapabilities = [
  {
    id: "session.recap",
    kind: "prompt_capability",
    name: "recap",
    description:
      "Ask Codex to summarize the current task, decisions, blockers, evidence, and next action.",
    invocation: 'codex exec --json "Produce a bounded task recap"',
    evidence: "codex exec --json",
    nativeCommand: "exec",
  },
  {
    id: "session.goal",
    kind: "prompt_capability",
    name: "goal",
    description: "Use Codex goal tools when the installed goals feature is enabled.",
    invocation: "Codex goal tools in the active session",
    evidence: "codex features list: goals",
    nativeFeature: "goals",
  },
];

function redactPath(value, home = os.homedir()) {
  if (typeof value !== "string") return value;
  const normalizedHome = path.resolve(home);
  const normalizedValue = path.resolve(value);
  if (normalizedValue === normalizedHome) return "~";
  if (normalizedValue.startsWith(`${normalizedHome}${path.sep}`)) {
    return `~/${path.relative(normalizedHome, normalizedValue).split(path.sep).join("/")}`;
  }
  return value;
}

function redactText(value, home) {
  return String(value ?? "")
    .replace(/(Bearer\s+)[^\s]+/gi, "$1[REDACTED]")
    .replace(/(token|secret|password|api[_-]?key)\s*[:=]\s*[^\s,]+/gi, "$1=[REDACTED]")
    .split("\n")
    .map((line) => line.replace(/\/home\/[^\s/]+/g, (match) => redactPath(match, home)))
    .join("\n")
    .slice(0, MAX_OUTPUT_BYTES);
}

function runNative(command, args, { cwd = process.cwd(), home = os.homedir(), timeoutMs } = {}) {
  const result = safeSpawnSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxBuffer: MAX_OUTPUT_BYTES,
  });
  return {
    command,
    args,
    status: result.status,
    ok: result.status === 0,
    stdout: redactText(result.stdout, home),
    stderr: redactText(result.stderr, home),
    error: result.error?.message ?? null,
  };
}

function parseTopLevelCommands(help) {
  const commands = [];
  let inCommands = false;
  for (const line of String(help ?? "").split(/\r?\n/)) {
    if (/^Commands:\s*$/.test(line.trim())) {
      inCommands = true;
      continue;
    }
    if (inCommands && /^Arguments:\s*$/.test(line.trim())) break;
    if (!inCommands) continue;
    const match = line.match(/^\s{2,}([a-z][a-z0-9-]+)(?:\s{2,}|\s{1,})(.+)$/i);
    if (!match || match[1] === "help" || nonCommandWords.has(match[1].toLowerCase())) continue;
    commands.push({ name: match[1], description: match[2].trim() });
  }
  return commands;
}

function parseFeatureFlags(output) {
  return String(output ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) =>
      line.match(
        /^([a-z][a-z0-9_.-]+)\s+(stable|experimental|under development|removed)\s+(true|false)$/i,
      ),
    )
    .filter(Boolean)
    .map(([, name, stage, enabled]) => ({
      name,
      stage,
      enabled: enabled === "true",
      source: "codex features list",
    }));
}

function parseMcpServers(output) {
  const records = [];
  for (const line of String(output ?? "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || /^Name\s+Command/i.test(trimmed) || /^Name\s+Url/i.test(trimmed)) continue;
    const match = trimmed.match(/^([a-zA-Z0-9_.-]+)\s{2,}(.+)$/);
    if (!match) continue;
    records.push({ name: match[1], detail: match[2].trim(), source: "codex mcp list" });
  }
  return records;
}

function parsePlugins(output, home) {
  const records = [];
  for (const line of String(output ?? "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || /^PLUGIN\s+STATUS/i.test(trimmed) || /^Marketplace\s+/i.test(trimmed)) continue;
    const match = trimmed.match(
      /^([^\s]+)\s{2,}(installed[^\s]*|not installed)\s{2,}([^\s]+)(?:\s{2,}(.*))?$/i,
    );
    if (!match) continue;
    records.push({
      name: match[1],
      status: match[2],
      version: match[3],
      source: redactText(match[4] ?? "", home),
      evidence: "codex plugin list",
    });
  }
  return records;
}

function parseDoctor(output, home) {
  try {
    const report = JSON.parse(output);
    return {
      schemaVersion: report.schemaVersion ?? null,
      overallStatus: report.overallStatus ?? "unknown",
      codexVersion: report.codexVersion ?? null,
      checks: Object.values(report.checks ?? {}).map((check) => ({
        id: check.id,
        category: check.category,
        status: check.status,
        summary: check.summary,
        details: redactText(JSON.stringify(check.details ?? {}), home),
      })),
    };
  } catch {
    return null;
  }
}

function createCapability({
  id,
  kind,
  name,
  description,
  status,
  invocation,
  evidence,
  metadata = {},
}) {
  return {
    id,
    kind,
    name,
    description,
    status,
    invocation,
    evidence,
    metadata,
    executionBoundary: "codex_native_read_only_discovery",
    mutationAllowed: false,
  };
}

function capabilityAliases(capability) {
  if (capability.kind === "mcp_server") return commandAliases.mcp;
  if (capability.kind === "plugin") return commandAliases.plugins;
  if (capability.kind === "feature_flag") return commandAliases.features;
  if (capability.kind === "diagnostic") return commandAliases.verification;
  if (capability.kind === "app_server_method") return commandAliases.sessions;
  if (capability.kind === "prompt_capability") {
    return (
      Object.values(commandAliases).find((aliases) =>
        aliases.some((alias) => capability.name.toLowerCase().includes(alias)),
      ) ?? []
    );
  }
  const commandName = capability.name.toLowerCase();
  return (
    Object.values(commandAliases).find((aliases) =>
      aliases.some((alias) => commandName === alias),
    ) ?? []
  );
}

export function selectCodexCapabilitiesForTask(inventory, taskIntent = "", maxCapabilities = 8) {
  if (!inventory || inventory.record_type !== "codex_capability_inventory") {
    throw new Error("invalid Codex capability inventory");
  }
  const tokens = [
    ...new Set(
      String(taskIntent)
        .toLowerCase()
        .match(/[a-z0-9][a-z0-9_-]{2,}/g) ?? [],
    ),
  ];
  const ranked = inventory.capabilities
    .map((capability) => {
      const haystack =
        capability.kind === "prompt_capability"
          ? capability.name.toLowerCase()
          : `${capability.id} ${capability.name} ${capability.kind}`.toLowerCase();
      const aliases = capabilityAliases(capability);
      const score = tokens.reduce((total, token) => {
        if (capability.kind === "prompt_capability" && token === capability.name.toLowerCase()) {
          return total + 100;
        }
        if (haystack.includes(token)) return total + 10;
        if (aliases.some((alias) => alias.includes(token) || token.includes(alias)))
          return total + 5;
        return total;
      }, 0);
      return { capability, score };
    })
    .filter(({ capability, score }) => capability.status === "available" && score > 0)
    .sort(
      (left, right) =>
        right.score - left.score || left.capability.id.localeCompare(right.capability.id),
    )
    .slice(0, maxCapabilities);
  return {
    record_type: "codex_capability_selection",
    schemaVersion: codexCapabilityInventorySchemaVersion,
    task_intent: String(taskIntent),
    selected: ranked.map(({ capability, score }) => ({
      ...capability,
      score,
      selectedReason: "task_intent_match",
    })),
    selected_count: ranked.length,
    authority: "$maestro",
    records_as: "available_capability_selection",
    never_records_as: "build_evidence",
  };
}

export function discoverCodexCapabilityInventory({
  command = "codex",
  cwd = process.cwd(),
  home = os.homedir(),
  run = runNative,
} = {}) {
  const probes = {
    help: run(command, ["--help"], { cwd, home }),
    version: run(command, ["--version"], { cwd, home }),
    features: run(command, ["features", "list"], { cwd, home }),
    mcp: run(command, ["mcp", "list"], { cwd, home }),
    plugins: run(command, ["plugin", "list"], { cwd, home }),
    doctor: run(command, ["doctor", "--json"], { cwd, home }),
  };
  const capabilities = [];
  const commands = parseTopLevelCommands(probes.help.stdout);
  const availableCommandNames = new Set(commands.map((item) => item.name));
  const featureFlags = parseFeatureFlags(probes.features.stdout);
  const featureNames = new Set(featureFlags.map((item) => item.name));
  for (const item of commands) {
    capabilities.push(
      createCapability({
        id: `cli.${item.name}`,
        kind: "cli_command",
        name: item.name,
        description: item.description,
        status: probes.help.ok ? "available" : "unknown",
        invocation: `${command} ${item.name}`,
        evidence: "codex --help",
      }),
    );
  }
  for (const promptCapability of promptCapabilities) {
    const isAvailable = promptCapability.nativeCommand
      ? availableCommandNames.has(promptCapability.nativeCommand)
      : featureNames.has(promptCapability.nativeFeature);
    capabilities.push(
      createCapability({
        ...promptCapability,
        status: isAvailable ? "available" : "disabled",
        metadata: {
          native_cli_command: promptCapability.nativeCommand ?? null,
          native_feature: promptCapability.nativeFeature ?? null,
          direct_cli_subcommand: false,
        },
      }),
    );
  }
  for (const flag of featureFlags) {
    capabilities.push(
      createCapability({
        id: `feature.${flag.name}`,
        kind: "feature_flag",
        name: flag.name,
        description: `${flag.stage} feature; effective state is ${flag.enabled ? "enabled" : "disabled"}`,
        status: flag.enabled ? "available" : "disabled",
        invocation: `codex --enable ${flag.name}`,
        evidence: flag.source,
        metadata: flag,
      }),
    );
  }
  for (const server of parseMcpServers(probes.mcp.stdout)) {
    capabilities.push(
      createCapability({
        id: `mcp.${server.name}`,
        kind: "mcp_server",
        name: server.name,
        description: server.detail,
        status: /enabled/i.test(server.detail) ? "available" : "disabled",
        invocation: "codex mcp list",
        evidence: server.source,
      }),
    );
  }
  for (const plugin of parsePlugins(probes.plugins.stdout, home)) {
    capabilities.push(
      createCapability({
        id: `plugin.${plugin.name}`,
        kind: "plugin",
        name: plugin.name,
        description: `${plugin.status} (${plugin.version})`,
        status: /^installed/i.test(plugin.status) ? "available" : "disabled",
        invocation: "codex plugin list",
        evidence: plugin.evidence,
        metadata: plugin,
      }),
    );
  }
  for (const method of appServerMethods) {
    capabilities.push(
      createCapability({
        id: `app_server.${method.replaceAll("/", ".")}`,
        kind: "app_server_method",
        name: method,
        description: `Codex app-server JSON-RPC method exposed by the MA client`,
        status: "available",
        invocation: method,
        evidence: "Meta-Architect CodexAppServerClient",
      }),
    );
  }
  const doctor = parseDoctor(probes.doctor.stdout, home);
  if (doctor) {
    capabilities.push(
      createCapability({
        id: "diagnostics.doctor",
        kind: "diagnostic",
        name: "doctor",
        description: `Codex installation diagnostics (${doctor.overallStatus})`,
        status: "available",
        invocation: "codex doctor --json",
        evidence: "codex doctor --json",
        metadata: doctor,
      }),
    );
  }
  return {
    schemaVersion: codexCapabilityInventorySchemaVersion,
    record_type: "codex_capability_inventory",
    generatedAt: new Date().toISOString(),
    codex: {
      command,
      version: probes.version.stdout.trim(),
      cwd: redactPath(cwd, home),
      probes: Object.fromEntries(
        Object.entries(probes).map(([name, result]) => [
          name,
          {
            ok: result.ok,
            status: result.status,
            error: result.error,
          },
        ]),
      ),
    },
    capabilities,
    summary: {
      total: capabilities.length,
      available: capabilities.filter((item) => item.status === "available").length,
      disabled: capabilities.filter((item) => item.status === "disabled").length,
      byKind: Object.fromEntries(
        [...new Set(capabilities.map((item) => item.kind))].map((kind) => [
          kind,
          capabilities.filter((item) => item.kind === kind).length,
        ]),
      ),
    },
    policy: {
      source_of_truth: "installed_codex_cli",
      selection_required: true,
      auto_execute: false,
      mutate_codex_configuration: false,
      records_as: "available_capability_inventory",
      never_records_as: "build_evidence",
      authority: "$maestro",
    },
  };
}

export async function persistCodexCapabilityInventory(inventory) {
  if (!inventory || inventory.record_type !== "codex_capability_inventory") {
    throw new Error("invalid Codex capability inventory");
  }
  await fs.mkdir(path.dirname(getCodexCapabilityInventoryPath()), { recursive: true });
  await writeJson(getCodexCapabilityInventoryPath(), inventory);
  return inventory;
}
