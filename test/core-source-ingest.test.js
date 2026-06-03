import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  coreSourceDefinitions,
  createDefaultCoreSourceIngest,
  findIngestedCoreSourceForRepo,
  ingestCoreSources,
  validateCoreSourceIngest,
} from "../src/runtime/core-source-ingest.js";

test("Core source ingest manifest defines semantic cores as local snapshots", () => {
  const manifest = validateCoreSourceIngest(createDefaultCoreSourceIngest());

  assert.equal(manifest.runtime_fetch_required, false);
  assert.equal(manifest.records_as, "core_source_snapshot");
  assert.equal(
    manifest.hard_rules.some((rule) => rule.includes("semantic cores, not MCP servers")),
    true,
  );
  assert.equal(
    manifest.sources.some(
      (source) => source.repo === "JuliusBrussee/caveman" && source.status === "NOT_INGESTED",
    ),
    true,
  );
});

test("Core source ingest records local clone snapshots and MA-owned Ralph core", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ma-core-ingest-"));
  const previousRoot = process.env.MA_ROOT;
  process.env.MA_ROOT = tempRoot;

  try {
    const sourceRoot = path.join(tempRoot, "fixtures", "external");
    await fs.mkdir(sourceRoot, { recursive: true });
    await fs.writeFile(
      path.join(sourceRoot, "README.md"),
      "# External Core\n\nCanonical content.\n",
    );
    await fs.mkdir(path.join(tempRoot, "src", "runtime"), { recursive: true });
    await fs.mkdir(path.join(tempRoot, "scripts", "ralph"), { recursive: true });
    await fs.writeFile(
      path.join(tempRoot, "src", "runtime", "ralph-execution-core.js"),
      "export const ralph = true;\n",
    );
    await fs.writeFile(path.join(tempRoot, "scripts", "ralph", "prompt.md"), "# Ralph\n");

    const manifest = await ingestCoreSources({
      definitions: [
        ...coreSourceDefinitions.map((definition) =>
          definition.source_type === "external_clone"
            ? { ...definition, source_url: sourceRoot }
            : definition,
        ),
      ],
      spawnImpl: (_command, args) => {
        const [, , , source, target] = args;
        return fakeCloneProcess(source, target);
      },
    });

    assert.equal(manifest.status, "READY");
    assert.equal(manifest.runtime_fetch_required, false);
    assert.equal(
      findIngestedCoreSourceForRepo(manifest, "obsidianmd/obsidian-api").status,
      "INGESTED",
    );
    assert.equal(
      findIngestedCoreSourceForRepo(manifest, "meta-architect/ralph-execution-core").status,
      "LOCAL_CORE",
    );
  } finally {
    if (previousRoot === undefined) {
      delete process.env.MA_ROOT;
    } else {
      process.env.MA_ROOT = previousRoot;
    }
  }
});

function fakeCloneProcess(source, target) {
  const listeners = new Map();
  const child = {
    stderr: {
      on() {},
    },
    on(event, listener) {
      listeners.set(event, listener);
      return child;
    },
  };
  queueMicrotask(async () => {
    try {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.cp(source, target, { recursive: true });
      listeners.get("exit")?.(0);
    } catch (error) {
      listeners.get("error")?.(error);
    }
  });
  return child;
}
