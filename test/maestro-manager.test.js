import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { cleanupTempRepo, createTempRepo } from "./helpers/temp-repo.js";

const repoRoot = process.cwd();

test("legacy manager runs without a decision field remain loadable", async () => {
  const tempRoot = await createTempRepo("meta-architect-manager-legacy-", repoRoot);
  const previousRoot = process.env.MA_ROOT;
  process.env.MA_ROOT = tempRoot;

  try {
    const manager = await import(
      `${pathToFileURL(path.join(repoRoot, "src", "runtime", "maestro-manager.js")).href}?t=${Date.now()}`
    );
    const current = manager.createManagerRun({ triggeredBy: "$maestro" });
    delete current.decision;
    const managerRunsPath = path.join(tempRoot, ".ma", "state", "manager-runs.json");
    await fs.mkdir(path.dirname(managerRunsPath), { recursive: true });
    await fs.writeFile(
      managerRunsPath,
      `${JSON.stringify({ schemaVersion: "0.1.0", runs: [current] }, null, 2)}\n`,
    );

    const loaded = await manager.loadManagerRunRegistry();
    assert.equal(loaded.runs[0].decision, null);
  } finally {
    if (previousRoot === undefined) delete process.env.MA_ROOT;
    else process.env.MA_ROOT = previousRoot;
    await cleanupTempRepo(tempRoot);
  }
});
