import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
const endpoint = process.env.MCP_RELEASE_URL ?? "https://ma.jstn.site/mcp";
const timeoutMs = Number(process.env.MCP_RELEASE_TIMEOUT_MS ?? 15_000);

if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) {
  throw new Error("MCP_RELEASE_TIMEOUT_MS must be an integer between 1000 and 120000");
}

function parseResponse(text) {
  const dataLines = text
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .filter(Boolean);
  const candidates = dataLines.length > 0 ? dataLines : [text.trim()];
  for (const candidate of candidates) {
    try {
      const value = JSON.parse(candidate);
      if (value?.result?.serverInfo) return value;
    } catch {}
  }
  throw new Error("MCP initialize response did not contain serverInfo");
}

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "meta-architect-release-verify", version: "1.0.0" },
    },
  }),
  signal: AbortSignal.timeout(timeoutMs),
});

if (!response.ok) {
  throw new Error(`MCP initialize failed with HTTP ${response.status}`);
}

const payload = parseResponse(await response.text());
const actualVersion = payload.result.serverInfo.version;
if (actualVersion !== packageJson.version) {
  throw new Error(
    `MCP version drift: expected ${packageJson.version}, received ${actualVersion} from ${endpoint}`,
  );
}

process.stdout.write(
  `${JSON.stringify({ endpoint, expectedVersion: packageJson.version, serverVersion: actualVersion })}\n`,
);
