import { ensureDir, readJson, writeFileIfMissing } from "../fs-utils.js";
import { getRuntimeSubsystemPath } from "../paths.js";

export const contextEconomySchemaVersion = "0.1.0";

const safetySignals = [
  "security warning",
  "irreversible",
  "destructive",
  "credential",
  "verification failed",
  "validation failed",
  "user confused",
];

const removableWords = new Set([
  "a",
  "an",
  "the",
  "just",
  "really",
  "basically",
  "sure",
  "happy",
  "glad",
]);

export function getContextEconomyCorePath() {
  return getRuntimeSubsystemPath("context", "context-economy-core.json");
}

export function createDefaultContextEconomyCore() {
  return {
    schemaVersion: contextEconomySchemaVersion,
    product: "Meta-Architect",
    purpose:
      "MA-owned default context compression policy for terse progress, summaries, MCP descriptors, and exported host payloads.",
    style: "compact_technical",
    evidence_source: {
      repo: "JuliusBrussee/caveman",
      endpoint: "https://gitmcp.io/JuliusBrussee/caveman",
      applied_as: "MA Context Economy Core",
      adoption_boundary:
        "Use the compression and auto-clarity contract as core MA behavior without adopting third-party persona branding.",
    },
    applies_to: [
      "$maestro",
      "gated_lanes",
      "helper_skills",
      "executor_roles",
      "reviewer_roles",
      "verifier_roles",
      "team_workers",
      "mcp_descriptors",
      "exported_host_payloads",
    ],
    preserve_exact: [
      "code_blocks",
      "commands",
      "schemas",
      "security_warnings",
      "authority_fields",
      "verification_failures",
      "known_gaps",
      "commit_messages",
    ],
    safety_valves: safetySignals,
    compression_rules: [
      "Remove filler and pleasantries from progress, summaries, and descriptors.",
      "Fragments are allowed when meaning stays exact.",
      "Keep technical nouns, commands, paths, code, schemas, evidence status, and blockers exact.",
      "Use auto-clarity bypass for safety warnings, irreversible actions, failed checks, credentials, and confused users.",
    ],
    hard_rules: [
      "Context Economy is default MA behavior, not a third-party persona.",
      "Technical terms, code, schemas, commands, warnings, and evidence boundaries stay exact.",
      "Disable compression when safety, authority, or user clarity would degrade.",
    ],
  };
}

function compactPlainText(text) {
  return text
    .split(/\s+/)
    .filter((word) => !removableWords.has(word.toLowerCase().replace(/[^a-z]/g, "")))
    .join(" ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

export function shouldBypassContextEconomy({ text = "", tags = [] } = {}) {
  const haystack = `${text} ${tags.join(" ")}`.toLowerCase();
  return safetySignals.some((signal) => haystack.includes(signal));
}

export function createContextEconomyView({ text, tags = [], level = "core" }) {
  if (typeof text !== "string") {
    throw new Error("Context Economy view requires text");
  }

  const bypassed = shouldBypassContextEconomy({ text, tags });
  const parts = text.split(/(```[\s\S]*?```)/g);
  const output = bypassed
    ? text
    : parts
        .map((part) => (part.startsWith("```") ? part : compactPlainText(part)))
        .join("")
        .trim();

  return {
    record_type: "context_economy_view",
    level,
    bypassed,
    records_as: "context_budget",
    original_chars: text.length,
    output_chars: output.length,
    output,
    preserved_exact: ["code_blocks", "commands", "warnings", "schemas", "authority_fields"],
  };
}

export function createContextEconomyPayload({
  surface = "$maestro",
  payload = {},
  tags = [],
  level = "core",
} = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Context Economy payload requires an object payload");
  }

  const transformed = {};
  const fields = [];
  for (const [key, value] of Object.entries(payload)) {
    const result = transformContextEconomyValue({ key, value, tags, level });
    transformed[key] = result.value;
    fields.push({
      key,
      compressed: result.compressed,
      bypassed: result.bypassed,
      original_chars: result.originalChars,
      output_chars: result.outputChars,
    });
  }

  return {
    record_type: "context_economy_payload",
    surface,
    level,
    records_as: "context_budget",
    build_evidence: false,
    payload: transformed,
    fields,
    preserved_exact: [
      "code",
      "commands",
      "paths",
      "schemas",
      "authority_fields",
      "security_warnings",
      "verification_evidence",
    ],
  };
}

export function createMcpDescriptorEconomy({ name, description, inputSchema = {}, tags = [] }) {
  if (!name || typeof name !== "string") {
    throw new Error("MCP descriptor economy requires a tool name");
  }
  const compacted = createContextEconomyView({
    text: description ?? "",
    tags,
    level: "mcp_descriptor",
  });
  return {
    record_type: "mcp_descriptor_economy",
    records_as: "context_budget",
    build_evidence: false,
    name,
    description: compacted.output,
    inputSchema,
    bypassed: compacted.bypassed,
    preserved_exact: ["name", "inputSchema"],
  };
}

export function validateContextEconomyCore(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Context Economy core must be an object");
  }
  if (value.schemaVersion !== contextEconomySchemaVersion) {
    throw new Error(`Unsupported Context Economy schemaVersion: ${value.schemaVersion}`);
  }
  if (value.evidence_source?.repo !== "JuliusBrussee/caveman") {
    throw new Error("Context Economy core requires Caveman evidence source mapping");
  }
  for (const required of ["code_blocks", "security_warnings", "authority_fields"]) {
    if (!value.preserve_exact?.includes(required)) {
      throw new Error(`Context Economy core must preserve ${required}`);
    }
  }
  if (!value.compression_rules?.some((rule) => rule.includes("auto-clarity bypass"))) {
    throw new Error("Context Economy core requires auto-clarity compression rule");
  }
  for (const signal of ["security warning", "irreversible", "verification failed"]) {
    if (!value.safety_valves?.includes(signal)) {
      throw new Error(`Context Economy core requires ${signal} safety valve`);
    }
  }
  if (JSON.stringify(value).includes(".omx")) {
    throw new Error("Context Economy core must not expose OMX runtime paths");
  }
  return value;
}

function transformContextEconomyValue({ key, value, tags, level }) {
  if (typeof value !== "string") {
    return {
      value,
      compressed: false,
      bypassed: false,
      originalChars: 0,
      outputChars: 0,
    };
  }
  if (shouldPreserveField(key)) {
    return {
      value,
      compressed: false,
      bypassed: true,
      originalChars: value.length,
      outputChars: value.length,
    };
  }
  const view = createContextEconomyView({ text: value, tags, level });
  return {
    value: view.output,
    compressed: !view.bypassed && view.output !== value,
    bypassed: view.bypassed,
    originalChars: view.original_chars,
    outputChars: view.output_chars,
  };
}

function shouldPreserveField(key) {
  const normalized = key.toLowerCase();
  return [
    "code",
    "command",
    "commands",
    "schema",
    "inputschema",
    "path",
    "paths",
    "authority",
    "authority_boundary",
    "security_warning",
    "warning",
    "verification_evidence",
    "evidence",
    "known_gap",
    "known_gaps",
  ].includes(normalized);
}

export async function seedContextEconomyCoreArtifacts() {
  await ensureDir(getRuntimeSubsystemPath("context"));
  await writeFileIfMissing(
    getContextEconomyCorePath(),
    `${JSON.stringify(createDefaultContextEconomyCore(), null, 2)}\n`,
  );
}

export async function loadContextEconomyCore() {
  return validateContextEconomyCore(await readJson(getContextEconomyCorePath()));
}
