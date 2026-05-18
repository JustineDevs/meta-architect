import { ensureDir, writeFileIfMissing } from "../fs-utils.js";
import { getRuntimeSubsystemPath } from "../paths.js";

export function getWorkspacesRoot() {
  return getRuntimeSubsystemPath("workspaces");
}

export function getWorkspacesIndexPath() {
  return getRuntimeSubsystemPath("workspaces", "index.json");
}

export async function seedWorkspaceArtifacts() {
  await ensureDir(getWorkspacesRoot());
  await writeFileIfMissing(
    getWorkspacesIndexPath(),
    `${JSON.stringify(
      {
        schemaVersion: "0.1.0",
        items: [],
      },
      null,
      2,
    )}\n`,
  );
}
