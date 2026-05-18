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

export function getRuntimeSubsystemPath(subsystem, ...parts) {
  return path.join(getRuntimeRoot(), subsystem, ...parts);
}

export function getRuntimeStatePath(...parts) {
  return getRuntimeSubsystemPath("state", ...parts);
}

export function getRuntimeWritePath(...parts) {
  return path.join(getRuntimeRoot(), ...parts);
}

export function getRuntimeReadPath(...parts) {
  return path.join(getRuntimeRoot(), ...parts);
}

export function getMcpRootPath() {
  return path.join(getRepoRoot(), "mcp");
}

export function getBundledMcpPath(...parts) {
  return path.join(packageRoot, "mcp", ...parts);
}

export function getMcpServersPath() {
  return path.join(getMcpRootPath(), "servers.json");
}

export function getMcpLocalCapabilitiesPath() {
  return path.join(getMcpRootPath(), "local-capabilities.json");
}

export function getBundledNativePlaybooksPath() {
  return getBundledMcpPath("native-playbooks.json");
}

export function getBundledDocsPath(...parts) {
  return path.join(packageRoot, "docs", ...parts);
}

export function getBundledSkillsPath(...parts) {
  return path.join(packageRoot, "skills", ...parts);
}
