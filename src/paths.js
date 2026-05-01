import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const packageRoot = path.resolve(__dirname, "..");
export const repoRoot = process.env.MA_ROOT ? path.resolve(process.env.MA_ROOT) : packageRoot;
export const omxRoot = path.join(repoRoot, ".omx");
export const releaseStatePath = path.join(omxRoot, "release.json");
export const decisionsPath = path.join(omxRoot, "decisions.json");
export const mcpServersPath = path.join(repoRoot, "mcp", "servers.json");
export const sourcesPath = path.join(omxRoot, "evidence", "sources.json");
export const auditsPath = path.join(omxRoot, "evidence", "audits.json");
export const outcomesPath = path.join(omxRoot, "evidence", "outcomes.json");
export const cvesPath = path.join(omxRoot, "evidence", "cves.json");
