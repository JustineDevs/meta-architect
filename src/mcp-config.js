import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { getBundledMcpPath, getMcpLocalCapabilitiesPath, getMcpServersPath } from "./paths.js";

const gitMcpRepoPattern = /^https:\/\/gitmcp\.io\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const localCapabilityNames = ["_state", "memory", "trace", "team_run", "code_intel", "playbooks"];
const localCapabilityNameSet = new Set(localCapabilityNames);

function validateObjectWithArray(parsed, arrayField, label) {
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed[arrayField])) {
    throw new Error(`${label} must be an object with a ${arrayField} array`);
  }

  return parsed;
}

function normalizeGitMcpDescriptor(server) {
  return {
    ...server,
    kind: server.kind ?? "gitmcp-evidence",
  };
}

export function isValidGitMcpEndpoint(url) {
  return gitMcpRepoPattern.test(url);
}

export async function loadMcpServers() {
  const raw = await fs.readFile(getMcpServersPath(), "utf8");
  const parsed = validateObjectWithArray(JSON.parse(raw), "servers", "mcp/servers.json");
  return {
    ...parsed,
    servers: parsed.servers.map(normalizeGitMcpDescriptor),
  };
}

export async function validateMcpServers() {
  const parsed = await loadMcpServers();
  for (const server of parsed.servers) {
    if (server.kind !== "gitmcp-evidence") {
      throw new Error(`Invalid GitMCP descriptor kind: ${server.kind ?? "(missing)"}`);
    }
    if (typeof server.category !== "string" || server.category.trim() === "") {
      throw new Error("GitMCP descriptors require a category");
    }
    if (typeof server.repo !== "string" || server.repo.trim() === "") {
      throw new Error("GitMCP descriptors require a repo");
    }
    if (!isValidGitMcpEndpoint(server.endpoint)) {
      throw new Error(`Invalid GitMCP endpoint: ${server.endpoint}`);
    }
  }

  return parsed;
}

export async function loadLocalCapabilities() {
  const raw = await fs.readFile(getMcpLocalCapabilitiesPath(), "utf8");
  return validateObjectWithArray(JSON.parse(raw), "capabilities", "mcp/local-capabilities.json");
}

export function getSupportedLocalCapabilities() {
  return [...localCapabilityNames];
}

export async function validateLocalCapabilities() {
  const parsed = await loadLocalCapabilities();
  const seen = new Set();

  for (const descriptor of parsed.capabilities) {
    if (descriptor.kind !== "local-capability") {
      throw new Error(`Invalid local capability kind: ${descriptor.kind ?? "(missing)"}`);
    }
    if (!localCapabilityNameSet.has(descriptor.capability)) {
      throw new Error(`Unsupported local capability: ${descriptor.capability}`);
    }
    if (seen.has(descriptor.capability)) {
      throw new Error(`Duplicate local capability: ${descriptor.capability}`);
    }
    if (descriptor.transport !== "inproc") {
      throw new Error(
        `Local capability ${descriptor.capability} must use inproc transport, received ${descriptor.transport}`,
      );
    }
    if (typeof descriptor.module !== "string" || descriptor.module.trim() === "") {
      throw new Error(`Local capability ${descriptor.capability} requires a module`);
    }
    if (typeof descriptor.readinessCheck !== "string" || descriptor.readinessCheck.trim() === "") {
      throw new Error(`Local capability ${descriptor.capability} requires a readinessCheck`);
    }
    if (descriptor.seededByBootstrap !== true) {
      throw new Error(
        `Local capability ${descriptor.capability} must declare seededByBootstrap: true`,
      );
    }
    seen.add(descriptor.capability);
  }

  for (const capability of localCapabilityNames) {
    if (!seen.has(capability)) {
      throw new Error(`Missing local capability descriptor: ${capability}`);
    }
  }

  return parsed;
}

export function resolveLocalCapabilityModulePath(descriptor) {
  if (path.isAbsolute(descriptor.module)) {
    throw new Error(`Local capability ${descriptor.capability} cannot use an absolute module path`);
  }

  const bundledLocalRoot = path.resolve(getBundledMcpPath("local"));
  const resolvedModulePath = path.resolve(getBundledMcpPath(descriptor.module));
  if (!resolvedModulePath.startsWith(`${bundledLocalRoot}${path.sep}`)) {
    throw new Error(
      `Local capability ${descriptor.capability} must resolve inside bundled mcp/local`,
    );
  }

  return resolvedModulePath;
}

export async function loadLocalCapabilityModule(descriptor) {
  const modulePath = resolveLocalCapabilityModulePath(descriptor);
  return import(pathToFileURL(modulePath).href);
}

export async function runLocalCapabilityReadinessChecks() {
  const parsed = await validateLocalCapabilities();
  const results = [];

  for (const descriptor of parsed.capabilities) {
    const moduleExports = await loadLocalCapabilityModule(descriptor);
    const readinessCheck = moduleExports[descriptor.readinessCheck];
    if (typeof readinessCheck !== "function") {
      throw new Error(
        `Local capability ${descriptor.capability} is missing readiness export ${descriptor.readinessCheck}`,
      );
    }

    const outcome = await readinessCheck();
    results.push({
      capability: descriptor.capability,
      ready: outcome?.ready !== false,
      detail: outcome?.detail ?? "",
    });
  }

  return results;
}
