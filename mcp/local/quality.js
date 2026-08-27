import fs from "node:fs/promises";
import path from "node:path";
import { getRepoRoot } from "../../src/paths.js";

const qualityRoot = () => path.join(getRepoRoot(), ".ma", "quality");

export const qualityResources = ["quality://violations", "quality://kpis"];

export async function readQualityResource(uri) {
  const file =
    uri === "quality://violations"
      ? "violations.json"
      : uri === "quality://kpis"
        ? "kpis.json"
        : null;
  if (!file) throw new Error(`Unknown quality resource: ${uri}`);
  try {
    return JSON.parse(await fs.readFile(path.join(qualityRoot(), file), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

export async function queryQualityStatus() {
  const [violations, kpis] = await Promise.all([
    readQualityResource("quality://violations"),
    readQualityResource("quality://kpis"),
  ]);
  return {
    violations,
    kpis,
    passed:
      violations.length > 0 &&
      kpis.length > 0 &&
      violations.every((record) => record.violations?.length === 0) &&
      kpis.every((record) => record.kpis?.qualityScore >= 60),
  };
}
