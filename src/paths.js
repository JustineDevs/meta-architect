import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const packageRoot = path.resolve(__dirname, "..");
export const repoRoot = process.env.MA_ROOT ? path.resolve(process.env.MA_ROOT) : packageRoot;
export const runtimeRoot = path.join(repoRoot, ".meta-architect");
export const releaseStatePath = path.join(runtimeRoot, "release.json");
export const decisionsPath = path.join(runtimeRoot, "decisions.json");
export const mcpServersPath = path.join(repoRoot, "mcp", "servers.json");
export const sourcesPath = path.join(runtimeRoot, "evidence", "sources.json");
export const auditsPath = path.join(runtimeRoot, "evidence", "audits.json");
export const outcomesPath = path.join(runtimeRoot, "evidence", "outcomes.json");
export const cvesPath = path.join(runtimeRoot, "evidence", "cves.json");
