import assert from "node:assert/strict";
import test from "node:test";
import {
  CodexAppServerClient,
  parseCodexJsonl,
  validateStructuredResult,
} from "../src/codex-app-server.js";

function fakeTransport() {
  const sent = [];
  let listener;
  return {
    sent,
    send(message) {
      sent.push(message);
      if (message.id && message.method)
        queueMicrotask(() =>
          listener({ jsonrpc: "2.0", id: message.id, result: { method: message.method } }),
        );
    },
    onMessage(fn) {
      listener = fn;
    },
    emit(message) {
      listener(message);
    },
  };
}

test("Codex app-server client performs lifecycle and config RPCs", async () => {
  const transport = fakeTransport();
  const client = new CodexAppServerClient({ transport, timeoutMs: 1000 });
  await client.initialize();
  await client.startThread({ ephemeral: true });
  await client.startTurn({ threadId: "t1", input: [] });
  await client.listThreads();
  await client.archiveThread({ threadId: "t1" });
  await client.readConfig();
  assert.deepEqual(
    transport.sent.map((message) => message.method),
    [
      "initialize",
      "initialized",
      "thread/start",
      "turn/start",
      "thread/list",
      "thread/archive",
      "config/read",
    ],
  );
});

test("Codex app-server forwards server requests to an explicit handler", async () => {
  const transport = fakeTransport();
  const client = new CodexAppServerClient({ transport });
  const requests = [];
  client.onServerRequest((message, respond) => {
    requests.push(message.method);
    respond({ approved: true });
  });
  transport.emit({ jsonrpc: "2.0", id: 99, method: "approval/request", params: {} });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(requests, ["approval/request"]);
  assert.deepEqual(transport.sent.at(-1), {
    jsonrpc: "2.0",
    id: 99,
    result: { approved: true },
  });
});

test("Codex JSONL and output schema helpers fail closed", () => {
  assert.deepEqual(parseCodexJsonl('{"type":"turn.completed"}\n'), [{ type: "turn.completed" }]);
  assert.throws(() => parseCodexJsonl("not-json"), /line 1/);
  assert.equal(
    validateStructuredResult(
      { status: "pass" },
      { type: "object", required: ["status"], properties: { status: { type: "string" } } },
    ),
    true,
  );
  assert.equal(validateStructuredResult({}, { type: "object", required: ["status"] }), false);
});
