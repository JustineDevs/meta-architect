import { spawn } from "node:child_process";

const GITMCP_ENDPOINT_PATTERN = /^https:\/\/gitmcp\.io\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const BRIDGE_COMMAND_ENV = "MA_MCP_REMOTE_BRIDGE_CMD";
const REQUEST_TIMEOUT_ENV = "MA_MCP_REQUEST_TIMEOUT_MS";
const DEFAULT_REQUEST_TIMEOUT_MS = 15000;

function readRequestTimeoutMs() {
  const raw = process.env[REQUEST_TIMEOUT_ENV]?.trim();
  if (!raw) return DEFAULT_REQUEST_TIMEOUT_MS;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_REQUEST_TIMEOUT_MS;
  }

  return Math.max(50, Math.floor(parsed));
}

export class McpRemoteTransportRequiredError extends Error {
  constructor(endpoint, status, bodyPreview = "") {
    const bridgeHint =
      `Set ${BRIDGE_COMMAND_ENV} to a trusted stdio bridge command with {url}, ` +
      "for example a preinstalled mcp-remote wrapper, then rerun $sage.";
    const bodyHint = bodyPreview ? ` Response preview: ${bodyPreview}` : "";
    super(
      `Remote MCP endpoint requires a bridge transport: ${endpoint} returned HTTP ${status}. ${bridgeHint}${bodyHint}`,
    );
    this.name = "McpRemoteTransportRequiredError";
    this.endpoint = endpoint;
    this.status = status;
    this.bridgeEnv = BRIDGE_COMMAND_ENV;
  }
}

export function isGitMcpEndpoint(endpoint) {
  return GITMCP_ENDPOINT_PATTERN.test(endpoint);
}

export function hasConfiguredMcpRemoteBridge() {
  return Boolean(process.env[BRIDGE_COMMAND_ENV]?.trim());
}

export function createMcpLiveClient(endpoint) {
  if (hasConfiguredMcpRemoteBridge()) {
    return new McpStdioBridgeClient(endpoint, process.env[BRIDGE_COMMAND_ENV]);
  }

  return new McpSseClient(endpoint);
}

export class McpSseClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.controller = new AbortController();
    this.reader = null;
    this.buffer = "";
    this.pending = new Map();
    this.postUrl = null;
    this.nextId = 1;
    this.readLoopPromise = null;
  }

  async connect() {
    const response = await fetch(this.baseUrl, {
      headers: { accept: "text/event-stream" },
      signal: this.controller.signal,
    });

    if (!response.ok || !response.body) {
      const bodyPreview = await readResponsePreview(response);
      if (isGitMcpEndpoint(this.baseUrl) && response.status === 405) {
        throw new McpRemoteTransportRequiredError(this.baseUrl, response.status, bodyPreview);
      }
      throw new Error(`Failed to open MCP SSE stream: ${response.status}`);
    }

    this.reader = response.body.getReader();
    const endpointEvent = await this.#withTimeout(
      this.#readNextEvent(),
      5000,
      "Timed out waiting for MCP endpoint event",
    );
    if (endpointEvent?.event !== "endpoint") {
      throw new Error("MCP server did not provide an endpoint event");
    }

    this.postUrl = `${this.baseUrl}${endpointEvent.data}`;
    this.readLoopPromise = this.#startReadLoop();

    const initResult = await this.request("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: {
        name: "meta-architect",
        version: "0.1.14-dev",
      },
    });

    await this.notify("notifications/initialized");
    return initResult;
  }

  async request(method, params = {}) {
    const id = this.nextId++;
    const responsePromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for MCP response to ${method}`));
      }, readRequestTimeoutMs());

      this.pending.set(id, {
        resolve: (payload) => {
          clearTimeout(timeout);
          resolve(payload);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
    });

    await this.#post({
      jsonrpc: "2.0",
      id,
      method,
      params,
    });

    return responsePromise;
  }

  async notify(method, params = {}) {
    await this.#post({
      jsonrpc: "2.0",
      method,
      params,
    });
  }

  async close() {
    this.controller.abort();
    if (this.readLoopPromise) {
      try {
        await this.readLoopPromise;
      } catch {
        // Ignore abort-related shutdown failures.
      }
    }
  }

  async #post(message) {
    const response = await fetch(this.postUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(message),
      signal: this.controller.signal,
    });

    if (!response.ok && response.status !== 202) {
      throw new Error(`MCP POST failed: ${response.status}`);
    }
  }

  async #startReadLoop() {
    try {
      while (true) {
        const event = await this.#readNextEvent();
        if (!event) {
          break;
        }

        if (event.event !== "message") {
          continue;
        }

        const payload = JSON.parse(event.data);
        if (typeof payload.id === "number" && this.pending.has(payload.id)) {
          const handlers = this.pending.get(payload.id);
          this.pending.delete(payload.id);
          if (payload.error) {
            handlers.reject(new Error(payload.error.message ?? "Unknown MCP error"));
          } else {
            handlers.resolve(payload.result);
          }
        }
      }
    } finally {
      for (const [, handlers] of this.pending) {
        handlers.reject(new Error("MCP stream closed"));
      }
      this.pending.clear();
    }
  }

  async #readNextEvent() {
    while (true) {
      const result = await this.reader.read();
      if (result.done) {
        return null;
      }

      this.buffer += Buffer.from(result.value).toString("utf8");
      const index = this.buffer.indexOf("\n\n");
      if (index === -1) {
        continue;
      }

      const rawEvent = this.buffer.slice(0, index);
      this.buffer = this.buffer.slice(index + 2);
      return parseSseEvent(rawEvent);
    }
  }

  async #withTimeout(promise, timeoutMs, message) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        const timeout = setTimeout(() => {
          clearTimeout(timeout);
          reject(new Error(message));
        }, timeoutMs);
      }),
    ]);
  }
}

export class McpStdioBridgeClient {
  constructor(endpoint, commandTemplate, spawnImpl = spawn) {
    this.endpoint = endpoint;
    this.commandTemplate = commandTemplate;
    this.spawnImpl = spawnImpl;
    this.child = null;
    this.buffer = "";
    this.pending = new Map();
    this.nextId = 1;
    this.stderr = "";
    this.closed = false;
  }

  async connect() {
    const { command, args } = buildBridgeCommand(this.commandTemplate, this.endpoint);
    this.child = this.spawnImpl(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });

    this.child.stdout.setEncoding("utf8");
    this.child.stderr.setEncoding("utf8");
    this.child.stdout.on("data", (chunk) => this.#handleStdout(chunk));
    this.child.stderr.on("data", (chunk) => {
      this.stderr = `${this.stderr}${chunk}`.slice(-2000);
    });
    this.child.on("error", (error) => {
      this.closed = true;
      for (const [, handlers] of this.pending) {
        handlers.reject(new Error(`MCP bridge failed to start: ${error.message}`));
      }
      this.pending.clear();
    });
    this.child.on("exit", (code, signal) => {
      this.closed = true;
      const reason = signal
        ? `MCP bridge exited with signal ${signal}`
        : `MCP bridge exited with code ${code}`;
      for (const [, handlers] of this.pending) {
        handlers.reject(new Error(`${reason}${this.stderr ? `: ${this.stderr.trim()}` : ""}`));
      }
      this.pending.clear();
    });

    const initResult = await this.request("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: {
        name: "meta-architect",
        version: "0.1.13-dev",
      },
    });

    await this.notify("notifications/initialized");
    return initResult;
  }

  async request(method, params = {}) {
    const id = this.nextId++;
    const responsePromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for MCP bridge response to ${method}`));
      }, readRequestTimeoutMs());

      this.pending.set(id, {
        resolve: (payload) => {
          clearTimeout(timeout);
          resolve(payload);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
    });

    this.#send({
      jsonrpc: "2.0",
      id,
      method,
      params,
    });

    return responsePromise;
  }

  async notify(method, params = {}) {
    this.#send({
      jsonrpc: "2.0",
      method,
      params,
    });
  }

  async close() {
    if (!this.child || this.closed) return;
    this.child.stdin.end();
    this.child.kill();
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 1000);
      this.child.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  #send(message) {
    if (!this.child?.stdin.writable) {
      throw new Error("MCP bridge is not writable");
    }
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  #handleStdout(chunk) {
    this.buffer += chunk;
    while (true) {
      const newlineIndex = this.buffer.indexOf("\n");
      if (newlineIndex === -1) return;

      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (!line?.startsWith("{")) continue;

      let payload;
      try {
        payload = JSON.parse(line);
      } catch {
        continue;
      }

      if (typeof payload.id !== "number" || !this.pending.has(payload.id)) {
        continue;
      }

      const handlers = this.pending.get(payload.id);
      this.pending.delete(payload.id);
      if (payload.error) {
        handlers.reject(new Error(payload.error.message ?? "Unknown MCP bridge error"));
      } else {
        handlers.resolve(payload.result);
      }
    }
  }
}

function buildBridgeCommand(commandTemplate, endpoint) {
  const template = commandTemplate?.trim();
  if (!template) {
    throw new Error(`${BRIDGE_COMMAND_ENV} is empty`);
  }

  const parts = splitCommand(template);
  if (parts.length === 0) {
    throw new Error(`${BRIDGE_COMMAND_ENV} is empty`);
  }

  const substituted = parts.map((part) => part.replaceAll("{url}", endpoint));
  if (!template.includes("{url}")) {
    substituted.push(endpoint);
  }

  const [command, ...args] = substituted;
  return { command, args };
}

async function readResponsePreview(response) {
  try {
    return (await response.text()).replace(/\s+/g, " ").trim().slice(0, 240);
  } catch {
    return "";
  }
}

function splitCommand(command) {
  const parts = [];
  let current = "";
  let quote = null;
  let escaping = false;

  for (const char of command) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (char === "\\") {
      escaping = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        parts.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (escaping) {
    current += "\\";
  }
  if (quote) {
    throw new Error(`${BRIDGE_COMMAND_ENV} has an unterminated quote`);
  }
  if (current) {
    parts.push(current);
  }

  return parts;
}

export function parseSseEvent(rawEvent) {
  const event = { event: "message", data: "" };
  for (const line of rawEvent.split("\n")) {
    if (line.startsWith("event:")) {
      event.event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      event.data += `${line.slice("data:".length).trim()}\n`;
    }
  }

  event.data = event.data.trimEnd();
  return event;
}
