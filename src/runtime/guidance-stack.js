import { ensureDir, writeFileIfMissing } from "../fs-utils.js";
import { getRuntimeSubsystemPath } from "../paths.js";

export function getGuidanceRoot() {
  return getRuntimeSubsystemPath("guidance");
}

export function getMergedGuidancePath() {
  return getRuntimeSubsystemPath("guidance", "merged.json");
}

export function getGuidanceIncludeGraphPath() {
  return getRuntimeSubsystemPath("guidance", "include-graph.json");
}

export async function seedGuidanceStackArtifacts() {
  await ensureDir(getGuidanceRoot());
  await writeFileIfMissing(
    getMergedGuidancePath(),
    `${JSON.stringify(
      {
        schemaVersion: "0.1.0",
        sources: [],
        content: "",
      },
      null,
      2,
    )}\n`,
  );
  await writeFileIfMissing(
    getGuidanceIncludeGraphPath(),
    `${JSON.stringify(
      {
        schemaVersion: "0.1.0",
        roots: [],
        edges: [],
      },
      null,
      2,
    )}\n`,
  );
}
