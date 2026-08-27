import path from "node:path";
import { loadLearningLoopCore, loadLearningRecords } from "../../src/runtime/learning-loop-core.js";
import {
  loadObsidianVaultIndex,
  loadObsidianVaultOperations,
} from "../../src/runtime/obsidian-integration-core.js";
import { resolvePreferences } from "../../src/runtime/preferences.js";
import { loadProjectIndex } from "../../src/runtime/project-context.js";
import {
  loadRuntimeHookReceipts,
  loadRuntimeHooksAuditLog,
  loadRuntimeHooksConfig,
} from "../../src/runtime/signal-hooks.js";

const contextResources = [
  "context://project-index",
  "context://learning",
  "context://obsidian",
  "context://hooks",
  "context://freshness",
  "context://commands",
  "context://agent-brief",
  "context://architecture",
  "context://preferences",
];

export function listContextResources() {
  return [...contextResources];
}

async function readOptional(loader, fallback) {
  try {
    return { available: true, data: await loader() };
  } catch (error) {
    if (error?.code === "ENOENT") return { available: false, data: fallback };
    throw error;
  }
}

function envelope(resource, result, extra = {}) {
  const freshness = extra.freshness ?? result.data?.freshness ?? null;
  return {
    record_type: `mcp_context:${resource}`,
    authority: "source_truth",
    source: "meta-architect-runtime",
    resource,
    ...extra,
    ...result,
    context: {
      authority: extra.authority ?? "generated_context",
      source: "meta-architect-runtime",
      freshness,
      provenance: result.data?.sourceFiles?.map((file) => file.path) ?? [],
    },
    quality: result.data?.quality ?? extra.quality ?? null,
  };
}

export async function readContextResource(uri) {
  if (uri === "context://project-index") {
    const result = await readOptional(loadProjectIndex, null);
    return envelope("project-index", result, {
      authority: result.available ? "source_truth" : "missing_source_truth",
      fact_ids: result.data?.facts?.map((fact) => fact.id) ?? [],
      provenance:
        result.data?.facts?.map((fact) => ({ id: fact.id, provenance: fact.provenance })) ?? [],
    });
  }

  if (uri === "context://learning") {
    const [core, records] = await Promise.all([
      readOptional(loadLearningLoopCore, null),
      readOptional(loadLearningRecords, []),
    ]);
    return envelope(
      "learning",
      {
        available: core.available || records.available,
        data: {
          core: core.data,
          records: records.data,
          failure_records: records.data.filter((record) => Boolean(record.failure_state)),
        },
      },
      {
        authority: "generated_context",
        fact_ids: records.data.flatMap((record) => record.fact_ids ?? []),
      },
    );
  }

  if (uri === "context://obsidian") {
    const [index, operations] = await Promise.all([
      readOptional(loadObsidianVaultIndex, null),
      readOptional(loadObsidianVaultOperations, null),
    ]);
    return envelope(
      "obsidian",
      {
        available: index.available || operations.available,
        data: { index: index.data, operations: operations.data },
      },
      { authority: "vault_note" },
    );
  }

  if (uri === "context://hooks") {
    const [config, audit, receipts] = await Promise.all([
      readOptional(loadRuntimeHooksConfig, null),
      readOptional(loadRuntimeHooksAuditLog, ""),
      readOptional(loadRuntimeHookReceipts, []),
    ]);
    return envelope(
      "hooks",
      {
        available: config.available || audit.available,
        data: { config: config.data, audit: audit.data, receipts: receipts.data },
      },
      { authority: "hook_evidence" },
    );
  }

  if (
    uri === "context://commands" ||
    uri === "context://agent-brief" ||
    uri === "context://architecture"
  ) {
    const relative = uri.slice("context://".length);
    const loader = async () => {
      if (relative === "commands") return readOptional(() => readJsonFile("commands.json"), null);
      return readOptional(() => readTextFile(`${relative}.md`), "");
    };
    const result = await loader();
    const project = await readOptional(loadProjectIndex, null);
    return envelope(relative, result, {
      authority: "generated_context",
      freshness: { status: "derived", stale: false, source: "project-index" },
      quality: project.data?.quality ?? null,
    });
  }

  if (uri === "context://freshness") {
    const result = await readOptional(loadProjectIndex, null);
    return envelope(
      "freshness",
      { available: result.available, data: result.data?.freshness ?? null },
      { authority: "source_truth" },
    );
  }

  if (uri === "context://preferences") {
    const result = await readOptional(resolvePreferences, {});
    return envelope("preferences", result, { authority: "learning_memory" });
  }

  throw new Error(`Unknown context resource: ${uri}`);
}

async function readJsonFile(name) {
  const { readJson } = await import("../../src/fs-utils.js");
  return readJson(path.join(process.env.MA_ROOT || process.cwd(), ".ma", "context", name));
}

async function readTextFile(name) {
  const fs = await import("node:fs/promises");
  return fs.readFile(
    path.join(process.env.MA_ROOT || process.cwd(), ".ma", "context", name),
    "utf8",
  );
}

export async function checkContextCapability() {
  const project = await readContextResource("context://project-index");
  return {
    ready: true,
    detail: project.available
      ? `project context loaded with ${project.data.sourceFiles?.length ?? 0} source file(s)`
      : "project context has not been generated; run ma setup",
  };
}
