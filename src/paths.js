import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const packageRoot = path.resolve(__dirname, "..");
export function getRepoRoot() {
  return process.env.MA_ROOT ? path.resolve(process.env.MA_ROOT) : process.cwd();
}

export function getRuntimeRoot() {
  return path.join(getRepoRoot(), ".ma");
}

export function getRuntimeWritePath(...parts) {
  return path.join(getRuntimeRoot(), ...parts);
}

export function getRuntimeReadPath(...parts) {
  return path.join(getRuntimeRoot(), ...parts);
}

export function getMcpServersPath() {
  return path.join(getRepoRoot(), "mcp", "servers.json");
}
