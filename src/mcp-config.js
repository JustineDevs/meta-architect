import fs from "node:fs/promises";
import { mcpServersPath } from "./paths.js";

const gitMcpRepoPattern = /^https:\/\/gitmcp\.io\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function isValidGitMcpEndpoint(url) {
  return gitMcpRepoPattern.test(url);
}

export async function loadMcpServers() {
  const raw = await fs.readFile(mcpServersPath, "utf8");
  const parsed = JSON.parse(raw);

  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.servers)) {
    throw new Error("mcp/servers.json must be an object with a servers array");
  }

  return parsed;
}

export async function validateMcpServers() {
  const parsed = await loadMcpServers();
  for (const server of parsed.servers) {
    if (!isValidGitMcpEndpoint(server.endpoint)) {
      throw new Error(`Invalid GitMCP endpoint: ${server.endpoint}`);
    }
  }

  return parsed;
}
