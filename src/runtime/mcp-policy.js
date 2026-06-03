import path from "node:path";
import { readJson } from "../fs-utils.js";
import {
  getMcpLocalCapabilitiesPath,
  getMcpServersPath,
  getRuntimeMcpPolicyPath,
} from "../paths.js";

const allowedExecutionModes = new Set(["READ_ONLY", "SANDBOX_MUTABLE"]);
const hardenedProfiles = new Set(["project", "deep", "hardened"]);

function createFinding({ sourcePath, severity = "high", diagnostic, recommendedAction }) {
  return {
    record_type: "policy:mcp_validation",
    severity,
    confidence: "high",
    source_path: sourcePath,
    diagnostic,
    recommended_action: recommendedAction,
  };
}

function isSafeRelativePath(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return false;
  }
  if (path.isAbsolute(value)) {
    return false;
  }
  const normalized = path.normalize(value);
  return normalized !== ".." && !normalized.startsWith(`..${path.sep}`);
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function validateRuntimeMcpPolicy({
  policy,
  localCapabilities,
  servers,
  activeProfile = "project",
  sourcePath = ".ma/.mcp.json",
} = {}) {
  const findings = [];
  const supportedCapabilities = new Set(
    normalizeArray(localCapabilities?.capabilities).map((descriptor) => descriptor.capability),
  );
  const approvedEndpoints = new Set(
    normalizeArray(servers?.servers)
      .map((server) => server.endpoint)
      .filter(Boolean),
  );
  const addFinding = (finding) => findings.push(createFinding({ sourcePath, ...finding }));

  if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
    addFinding({
      diagnostic: "Runtime-local MCP policy must be a JSON object.",
      recommendedAction: "Replace .ma/.mcp.json with an object that narrows repo-owned MCP access.",
    });
    return findings;
  }

  if (policy.schemaVersion !== undefined && policy.schemaVersion !== "0.1.0") {
    addFinding({
      severity: "warning",
      diagnostic: `Unsupported runtime-local MCP policy schemaVersion: ${policy.schemaVersion}.`,
      recommendedAction:
        "Use schemaVersion 0.1.0 or omit schemaVersion until the contract changes.",
    });
  }

  const policyMode = policy.executionMode ?? policy.execution_mode ?? "READ_ONLY";
  if (!allowedExecutionModes.has(policyMode)) {
    addFinding({
      diagnostic: `Runtime-local MCP policy requests unsupported execution mode '${policyMode}'.`,
      recommendedAction:
        "Use READ_ONLY, or SANDBOX_MUTABLE only for explicitly permitted non-hardened runs.",
    });
  } else if (hardenedProfiles.has(activeProfile) && policyMode !== "READ_ONLY") {
    addFinding({
      diagnostic: `Runtime-local MCP policy cannot use ${policyMode} while profile '${activeProfile}' is hardened.`,
      recommendedAction:
        "Switch the runtime-local policy to READ_ONLY for project/deep/hardened profiles.",
    });
  }

  for (const capability of normalizeArray(policy.capabilities)) {
    const capabilityName = capability.capability ?? capability.name;
    if (!supportedCapabilities.has(capabilityName)) {
      addFinding({
        diagnostic: `Runtime-local MCP policy references unsupported capability '${capabilityName ?? "(missing)"}'.`,
        recommendedAction:
          "Keep runtime-local capability entries as a subset of mcp/local-capabilities.json.",
      });
    }

    const modulePath = capability.module;
    if (modulePath !== undefined && !isSafeRelativePath(modulePath)) {
      addFinding({
        diagnostic: `Runtime-local MCP policy capability '${capabilityName ?? "(missing)"}' uses unsafe module path '${modulePath}'.`,
        recommendedAction:
          "Use safe repo-relative paths only; reject absolute paths and traversal.",
      });
    }

    const capabilityMode = capability.executionMode ?? capability.execution_mode;
    if (capabilityMode !== undefined && !allowedExecutionModes.has(capabilityMode)) {
      addFinding({
        diagnostic: `Runtime-local MCP policy capability '${capabilityName ?? "(missing)"}' requests unsupported execution mode '${capabilityMode}'.`,
        recommendedAction:
          "Use READ_ONLY, or SANDBOX_MUTABLE only where the active profile allows it.",
      });
    } else if (
      capabilityMode !== undefined &&
      hardenedProfiles.has(activeProfile) &&
      capabilityMode !== "READ_ONLY"
    ) {
      addFinding({
        diagnostic: `Runtime-local MCP policy capability '${capabilityName ?? "(missing)"}' cannot use ${capabilityMode} while profile '${activeProfile}' is hardened.`,
        recommendedAction: "Switch capability execution to READ_ONLY for hardened profiles.",
      });
    }
  }

  for (const allowedPath of normalizeArray(policy.allowedPaths ?? policy.allowed_paths)) {
    if (!isSafeRelativePath(allowedPath)) {
      addFinding({
        diagnostic: `Runtime-local MCP policy contains unsafe allowed path '${allowedPath}'.`,
        recommendedAction: "Use safe repo-relative allowed paths only.",
      });
    }
  }

  for (const endpoint of normalizeArray(policy.evidenceSources ?? policy.evidence_sources)) {
    if (!approvedEndpoints.has(endpoint)) {
      addFinding({
        diagnostic: `Runtime-local MCP policy references unapproved evidence source '${endpoint}'.`,
        recommendedAction:
          "Keep runtime-local evidence sources as a subset of mcp/servers.json exact GitMCP endpoints.",
      });
    }
  }

  const envAllowlist =
    policy.envAllowlist ?? policy.env_allowlist ?? policy.env?.allowlist ?? policy.env?.allow;
  if (envAllowlist !== undefined) {
    if (!Array.isArray(envAllowlist)) {
      addFinding({
        diagnostic: "Runtime-local MCP policy env allowlist must be an array.",
        recommendedAction: "Use an explicit array of environment variable names.",
      });
    } else {
      for (const entry of envAllowlist) {
        if (
          typeof entry !== "string" ||
          entry.trim() === "" ||
          entry === "*" ||
          entry.includes("*")
        ) {
          addFinding({
            diagnostic: `Runtime-local MCP policy env allowlist contains unsafe entry '${entry}'.`,
            recommendedAction:
              "List exact environment variable names only; wildcard env access is not allowed.",
          });
        }
      }
    }
  }

  return findings;
}

export async function validateRuntimeMcpPolicyFile({ activeProfile = "project" } = {}) {
  let policy;
  try {
    policy = await readJson(getRuntimeMcpPolicyPath());
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  return validateRuntimeMcpPolicy({
    policy,
    localCapabilities: await readJson(getMcpLocalCapabilitiesPath()),
    servers: await readJson(getMcpServersPath()),
    activeProfile,
    sourcePath: getRuntimeMcpPolicyPath(),
  });
}
