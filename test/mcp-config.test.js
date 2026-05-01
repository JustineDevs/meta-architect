import assert from "node:assert/strict";
import test from "node:test";
import { isValidGitMcpEndpoint } from "../src/mcp-config.js";
import { parseSseEvent } from "../src/mcp-live-client.js";

test("validates exact GitMCP repo endpoints and docs fallback", () => {
  assert.equal(isValidGitMcpEndpoint("https://gitmcp.io/sindresorhus/awesome"), true);
  assert.equal(isValidGitMcpEndpoint("https://gitmcp.io/docs"), false);
  assert.equal(isValidGitMcpEndpoint("https://example.com/not-gitmcp"), false);
});

test("parses SSE endpoint events", () => {
  const parsed = parseSseEvent("event: endpoint\ndata: /*/message?sessionId=abc123\n");
  assert.equal(parsed.event, "endpoint");
  assert.equal(parsed.data, "/*/message?sessionId=abc123");
});
