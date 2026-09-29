import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const verifier = path.join(root, "scripts", "mcp-release-verify.mjs");

async function runVerifier(version) {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(
      `event: message\ndata: ${JSON.stringify({ result: { serverInfo: { version } } })}\n\n`,
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const child = spawn(process.execPath, [verifier], {
    cwd: root,
    env: { ...process.env, MCP_RELEASE_URL: `http://127.0.0.1:${port}/mcp` },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const exitCode = await new Promise((resolve) => child.on("close", resolve));
  await new Promise((resolve) => server.close(resolve));
  return { exitCode, stdout, stderr };
}

test("MCP release verifier accepts the package version", async () => {
  const result = await runVerifier("0.15.3");
  assert.equal(result.exitCode, 0, result.stderr);
  assert.match(result.stdout, /"serverVersion":"0\.15\.3"/);
});

test("MCP release verifier rejects version drift", async () => {
  const result = await runVerifier("0.15.2");
  assert.notEqual(result.exitCode, 0);
  assert.match(`${result.stdout}${result.stderr}`, /MCP version drift/);
});
