import fs from "node:fs/promises";
import path from "node:path";
import { getMcpRootPath } from "../paths.js";

export const sourceRegistrySchemaVersion = "1.0.0";
const roles = new Set(["project", "authoritative", "reference", "discovery", "runtime"]);
const evidenceRoles = new Set(["project", "authoritative", "reference"]);
const laneIds = new Set(["arch", "sage", "flow", "vet", "vibe", "build"]);

export function getSourceRegistryPath() {
  return path.join(getMcpRootPath(), "source-registry.json");
}

export function validateSourceRegistry(registry) {
  if (
    !registry ||
    typeof registry !== "object" ||
    registry.schemaVersion !== sourceRegistrySchemaVersion
  ) {
    throw new Error(`Source registry requires schemaVersion=${sourceRegistrySchemaVersion}`);
  }
  if (registry.recordType !== "source_registry" || !Array.isArray(registry.sources)) {
    throw new Error("Source registry requires recordType and sources");
  }
  if (
    registry.policy?.discoveryUnlocksEvidence !== false ||
    registry.policy?.verifiedRequiresPinnedContent !== true
  ) {
    throw new Error("Source registry policy must fail closed for discovery and unpinned content");
  }
  const ids = new Set();
  const repos = new Set();
  for (const source of registry.sources) {
    if (!source.id || ids.has(source.id)) throw new Error(`Duplicate source id: ${source.id}`);
    if (!roles.has(source.role)) throw new Error(`Unsupported source role: ${source.role}`);
    if (!source.repo || repos.has(source.repo))
      throw new Error(`Duplicate source repo: ${source.repo}`);
    if (!/^https:\/\/gitmcp\.io\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(source.endpoint)) {
      throw new Error(`Invalid source endpoint: ${source.endpoint}`);
    }
    if (
      !Array.isArray(source.allowedLanes) ||
      source.allowedLanes.some((lane) => !laneIds.has(lane))
    ) {
      throw new Error(`Invalid allowed lanes for source: ${source.id}`);
    }
    if (
      source.role === "discovery" &&
      source.requiredClaims.some((claim) => claim === "commit_pin" || claim === "content_match")
    ) {
      throw new Error(`Discovery source cannot require promotion claims: ${source.id}`);
    }
    ids.add(source.id);
    repos.add(source.repo);
  }
  return registry;
}

export async function loadSourceRegistry() {
  return validateSourceRegistry(JSON.parse(await fs.readFile(getSourceRegistryPath(), "utf8")));
}

export function selectSourcesForLane(registry, lane, { evidenceOnly = true } = {}) {
  if (!laneIds.has(lane)) throw new Error(`Unknown source lane: ${lane}`);
  return registry.sources.filter(
    (source) =>
      source.allowedLanes.includes(lane) && (!evidenceOnly || evidenceRoles.has(source.role)),
  );
}

export function canUnlockEvidence(source) {
  return (
    evidenceRoles.has(source?.role) &&
    source?.requiredClaims?.includes("commit_pin") &&
    source?.requiredClaims?.includes("content_match")
  );
}
