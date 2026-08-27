import { spawn } from "node:child_process";
import fs from "node:fs";

const PACKAGE_VERSION = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).version;

const DEFAULT_TIMEOUT_MS = 30_000;

export class CodexRpcError extends Error {
  constructor(message, error) {
    super(message);
    this.name = "CodexRpcError";
    this.code = error?.code;
    this.data = error?.data;
  }
}

export class CodexAppServerClient {
  constructor({ transport, command = "codex", timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    this.transport = transport ?? createStdioTransport(command);
    this.timeoutMs = timeoutMs;
    this.nextId = 1;
    this.pending = new Map();
    this.notifications = new Set();
    this.serverRequests = new Set();
    this.transport.onMessage((message) => this.#receive(message));
  }

  async request(method, params = {}, timeoutMs = this.timeoutMs) {
    const id = this.nextId++;
    const message = { jsonrpc: "2.0", id, method, params };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex app-server request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer, method });
      try {
        this.transport.send(message);
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  notify(method, params = {}) {
    this.transport.send({ jsonrpc: "2.0", method, params });
  }

  onNotification(listener) {
    this.notifications.add(listener);
    return () => this.notifications.delete(listener);
  }

  onServerRequest(listener) {
    this.serverRequests.add(listener);
    return () => this.serverRequests.delete(listener);
  }

  async initialize(clientInfo = { name: "meta-architect", version: PACKAGE_VERSION }) {
    const result = await this.request("initialize", {
      clientInfo,
      capabilities: {},
    });
    this.notify("initialized", {});
    return result;
  }

  startThread(params = {}) {
    return this.request("thread/start", params);
  }

  resumeThread(params) {
    return this.request("thread/resume", params);
  }

  forkThread(params) {
    return this.request("thread/fork", params);
  }

  listThreads(params = {}) {
    return this.request("thread/list", params);
  }

  archiveThread(params) {
    return this.request("thread/archive", params);
  }

  startTurn(params) {
    return this.request("turn/start", params);
  }

  interruptTurn(params) {
    return this.request("turn/interrupt", params);
  }

  readConfig(params = {}) {
    return this.request("config/read", params);
  }

  writeConfig(params = {}) {
    return this.request("config/batchWrite", params);
  }

  close() {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Codex app-server client closed"));
    }
    this.pending.clear();
    return this.transport.close?.();
  }

  #receive(message) {
    if (message && Object.hasOwn(message, "id")) {
      const pending = this.pending.get(message.id);
      if (!pending) {
        if (message.method) {
          for (const listener of this.serverRequests)
            listener(message, (result) => this.#respond(message.id, result));
        } else {
          this.#respond(message.id, undefined, { code: -32600, message: "Unknown response id" });
        }
        return;
      }
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.error)
        pending.reject(
          new CodexRpcError(`Codex app-server ${pending.method} failed`, message.error),
        );
      else pending.resolve(message.result);
      return;
    }
    for (const listener of this.notifications) listener(message);
  }

  #respond(id, result, error) {
    this.transport.send({ jsonrpc: "2.0", id, ...(error ? { error } : { result }) });
  }
}

export function createStdioTransport(command = "codex") {
  const child = spawn(command, ["app-server", "--stdio"], {
    stdio: ["pipe", "pipe", "inherit"],
    shell: false,
  });
  let buffer = "";
  const listeners = new Set();
  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    for (;;) {
      const newline = buffer.indexOf("\n");
      if (newline < 0) break;
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }
      for (const listener of listeners) listener(message);
    }
  });
  return {
    send(message) {
      if (!child.stdin.writable) throw new Error("Codex app-server stdin is closed");
      child.stdin.write(`${JSON.stringify(message)}\n`);
    },
    onMessage(listener) {
      listeners.add(listener);
    },
    close() {
      child.kill();
    },
    child,
  };
}

export function parseCodexJsonl(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid Codex exec JSONL at line ${index + 1}: ${error.message}`);
      }
    });
}

export function runCodexExec({
  prompt,
  args = [],
  command = "codex",
  cwd,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (typeof prompt !== "string" || !prompt.trim()) throw new Error("Codex exec requires a prompt");
  return new Promise((resolve, reject) => {
    const child = spawn(command, ["exec", "--json", ...args, prompt], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Codex exec timed out"));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      let events;
      try {
        events = parseCodexJsonl(stdout);
      } catch (error) {
        reject(error);
        return;
      }
      if (code !== 0) {
        reject(new Error(`Codex exec failed with exit code ${code}: ${stderr.trim()}`));
        return;
      }
      resolve({ code, events, stderr: stderr.trim() });
    });
  });
}

export function generateCodexBindings({
  kind = "ts",
  outDir,
  command = "codex",
  cwd,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (!outDir) throw new Error("Codex binding generation requires an output directory");
  const generator = kind === "json-schema" ? "generate-json-schema" : "generate-ts";
  return new Promise((resolve, reject) => {
    const child = spawn(command, ["app-server", generator, "--out", outDir], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Codex binding generation timed out"));
    }, timeoutMs);
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0)
        reject(
          new Error(`Codex binding generation failed with exit code ${code}: ${stderr.trim()}`),
        );
      else resolve({ code: code ?? 0, output: outDir, kind });
    });
  });
}

export function validateStructuredResult(value, schema) {
  if (!schema || typeof schema !== "object") throw new Error("Output schema is required");
  if (schema.type === "object" && (!value || typeof value !== "object" || Array.isArray(value)))
    return false;
  for (const required of schema.required ?? []) if (!Object.hasOwn(value, required)) return false;
  for (const [key, rule] of Object.entries(schema.properties ?? {})) {
    if (!Object.hasOwn(value, key)) continue;
    if (rule.type === "string" && typeof value[key] !== "string") return false;
    if (rule.type === "number" && typeof value[key] !== "number") return false;
    if (rule.type === "boolean" && typeof value[key] !== "boolean") return false;
  }
  return true;
}
