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
      throw new Error(`Failed to open MCP SSE stream: ${response.status}`);
    }

    this.reader = response.body.getReader();
    const endpointEvent = await this.#withTimeout(
      this.#readNextEvent(),
      5000,
      "Timed out waiting for MCP endpoint event",
    );
    if (!endpointEvent || endpointEvent.event !== "endpoint") {
      throw new Error("MCP server did not provide an endpoint event");
    }

    this.postUrl = `${this.baseUrl}${endpointEvent.data}`;
    this.readLoopPromise = this.#startReadLoop();

    const initResult = await this.request("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: {
        name: "meta-architect",
        version: "0.1.3",
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
      }, 15000);

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
