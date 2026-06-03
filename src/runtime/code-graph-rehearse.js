import fs from "node:fs/promises";
import path from "node:path";
import { ensureDir, readJson, writeFileIfMissing } from "../fs-utils.js";
import { getRuntimeSubsystemPath } from "../paths.js";

export const codeGraphRehearseSchemaVersion = "0.1.0";
const defaultMaxSteps = 12;

export function getCodeGraphRehearsePath() {
  return getRuntimeSubsystemPath("context", "code-graph-rehearse.json");
}

export function createDefaultCodeGraphRehearse() {
  return {
    schemaVersion: codeGraphRehearseSchemaVersion,
    product: "Meta-Architect",
    purpose:
      "Provides a bounded read-only trajectory preview over likely code touchpoints before execution.",
    max_steps: defaultMaxSteps,
    mutation_policy: {
      may_mutate_source: false,
      may_mutate_release_state: false,
    },
    evidence_boundary: {
      records_as: "rehearsal_trace",
      never_records_as: "implementation_evidence",
      does_not_unlock: ["source_mutation", "production_release"],
    },
    applies_to: ["$arch", "$flow", "$build", "executor_roles"],
  };
}

export function validateCodeGraphRehearse(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("code graph rehearse must be an object");
  }
  if (value.schemaVersion !== codeGraphRehearseSchemaVersion) {
    throw new Error(`Unsupported code graph rehearse schemaVersion: ${value.schemaVersion}`);
  }
  if (!Number.isInteger(value.max_steps) || value.max_steps <= 0) {
    throw new Error("code graph rehearse requires positive max_steps");
  }
  if (value.mutation_policy?.may_mutate_source !== false) {
    throw new Error("code graph rehearse must not mutate source");
  }
  if (value.evidence_boundary?.records_as !== "rehearsal_trace") {
    throw new Error("code graph rehearse must record as rehearsal_trace");
  }
  return value;
}

export async function seedCodeGraphRehearseArtifacts() {
  await ensureDir(getRuntimeSubsystemPath("context"));
  await writeFileIfMissing(
    getCodeGraphRehearsePath(),
    `${JSON.stringify(createDefaultCodeGraphRehearse(), null, 2)}\n`,
  );
}

export async function loadCodeGraphRehearse() {
  return validateCodeGraphRehearse(await readJson(getCodeGraphRehearsePath()));
}

export function createCodeGraphTouchpoint(filePath, imports = []) {
  return {
    path: filePath,
    extension: path.extname(filePath),
    imports: imports.filter((entry) => typeof entry === "string" && entry.trim()),
  };
}

export function extractStaticImports(sourceText) {
  const imports = new Set();
  const patterns = [
    /import\s+(?:[^'"]+\s+from\s+)?["']([^"']+)["']/g,
    /export\s+[^'"]+\s+from\s+["']([^"']+)["']/g,
    /await\s+import\(["']([^"']+)["']\)/g,
    /import\(["']([^"']+)["']\)/g,
    /require\(["']([^"']+)["']\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of sourceText.matchAll(pattern)) {
      if (match[1]) {
        imports.add(match[1]);
      }
    }
  }

  return [...imports].sort();
}

export async function createCodeGraphTouchpointFromFile(filePath) {
  const sourceText = await fs.readFile(filePath, "utf8");
  return createCodeGraphTouchpoint(filePath, extractStaticImports(sourceText));
}

export function createRehearsalTrace({ story, touchpoints = [], plannedSteps = [], maxSteps }) {
  const limit = Number.isInteger(maxSteps) && maxSteps > 0 ? maxSteps : defaultMaxSteps;
  const boundedSteps = plannedSteps.slice(0, limit);
  return {
    record_type: "rehearsal_trace",
    story,
    bounded: plannedSteps.length <= limit,
    truncated: plannedSteps.length > limit,
    max_steps: limit,
    steps: boundedSteps,
    touchpoints,
    source_mutation_allowed: false,
    production_evidence: false,
    does_not_unlock: ["source_mutation", "production_release"],
  };
}
