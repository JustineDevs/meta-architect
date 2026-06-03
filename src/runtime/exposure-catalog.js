import path from "node:path";
import { readJson } from "../fs-utils.js";
import { getMcpLocalCapabilitiesPath, getMcpServersPath, getRepoRoot } from "../paths.js";
import { validateRuntimeMcpPolicyFile } from "./mcp-policy.js";

const advisoryCatalog = [
  {
    ecosystem: "npm",
    packageName: "tar",
    vulnerableBelow: "6.2.1",
    severity: "critical",
    confidence: "high",
    diagnostic: "tar < 6.2.1 allows arbitrary file overwrite.",
    recommendedAction: "Upgrade tar to 6.2.1 or newer in the lockfile and reverify.",
    advisoryReference: "advisory-2026-0042",
  },
];

function normalizePackageNameFromLockPath(lockPath) {
  const marker = "node_modules/";
  const markerIndex = lockPath.lastIndexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  return lockPath.slice(markerIndex + marker.length);
}

function compareSemver(a, b) {
  const parse = (value) =>
    `${value}`.split(".").map((part) => Number.parseInt(part.replace(/[^0-9].*$/, ""), 10) || 0);
  const left = parse(a);
  const right = parse(b);
  const maxLength = Math.max(left.length, right.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    if (leftValue > rightValue) {
      return 1;
    }
    if (leftValue < rightValue) {
      return -1;
    }
  }

  return 0;
}

function normalizeManifestVersion(value) {
  const match = `${value}`.match(/\d+(?:\.\d+){0,2}/);
  return match ? match[0] : null;
}

export async function scanLockfilePackageExposure() {
  const lockfilePath = path.join(getRepoRoot(), "package-lock.json");
  let lockfile;
  try {
    lockfile = await readJson(lockfilePath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  return scanPackageExposureFromLockfile(lockfile, {
    sourcePath: lockfilePath,
    catalog: advisoryCatalog,
  });
}

export function scanPackageExposureFromLockfile(
  lockfile,
  { sourcePath = "package-lock.json", catalog = advisoryCatalog } = {},
) {
  const packages = lockfile?.packages ?? {};
  const findings = [];

  for (const [lockPath, entry] of Object.entries(packages)) {
    if (!lockPath || lockPath === "" || !entry?.version) {
      continue;
    }

    const packageName = normalizePackageNameFromLockPath(lockPath);
    if (!packageName) {
      continue;
    }

    for (const advisory of catalog) {
      if (packageName !== advisory.packageName) {
        continue;
      }

      if (compareSemver(entry.version, advisory.vulnerableBelow) >= 0) {
        continue;
      }

      findings.push({
        record_type: "finding:package_exposure",
        severity: advisory.severity,
        confidence: advisory.confidence,
        ecosystem: advisory.ecosystem,
        package_name: packageName,
        package_version: entry.version,
        source_path: sourcePath,
        evidence_kind: "lockfile-version-match",
        diagnostic: advisory.diagnostic,
        recommended_action: advisory.recommendedAction,
        advisory_reference: advisory.advisoryReference,
      });
    }
  }

  return findings;
}

export function scanPackageExposureFromManifest(
  manifest,
  { sourcePath = "package.json", catalog = advisoryCatalog } = {},
) {
  const dependencyGroups = [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ];
  const findings = [];

  for (const group of dependencyGroups) {
    for (const [packageName, versionRange] of Object.entries(manifest?.[group] ?? {})) {
      const normalizedVersion = normalizeManifestVersion(versionRange);
      if (!normalizedVersion) {
        continue;
      }

      for (const advisory of catalog) {
        if (packageName !== advisory.packageName) {
          continue;
        }
        if (compareSemver(normalizedVersion, advisory.vulnerableBelow) >= 0) {
          continue;
        }

        findings.push({
          record_type: "finding:package_exposure",
          severity: advisory.severity,
          confidence: "medium",
          ecosystem: advisory.ecosystem,
          package_name: packageName,
          package_version: versionRange,
          normalized_version: normalizedVersion,
          source_path: sourcePath,
          evidence_kind: "manifest-version-range-match",
          dependency_group: group,
          diagnostic: advisory.diagnostic,
          recommended_action: advisory.recommendedAction,
          advisory_reference: advisory.advisoryReference,
        });
      }
    }
  }

  return findings;
}

export async function validateMcpPolicyExposure({ activeProfile = "project" } = {}) {
  const findings = [];

  try {
    const localCapabilities = await readJson(getMcpLocalCapabilitiesPath());
    for (const capability of localCapabilities.capabilities ?? []) {
      if (
        typeof capability.module === "string" &&
        !capability.module.startsWith("./local/") &&
        capability.kind === "local-capability"
      ) {
        findings.push({
          record_type: "policy:mcp_validation",
          severity: "warning",
          confidence: "high",
          diagnostic: `Local capability module '${capability.module}' escapes the expected ./local/ namespace.`,
          source_path: getMcpLocalCapabilitiesPath(),
          recommended_action:
            "Keep packaged local capability modules inside the ./local/ namespace or document the exception explicitly.",
        });
      }
    }
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }

  try {
    const servers = await readJson(getMcpServersPath());
    for (const server of servers.servers ?? []) {
      if (typeof server.endpoint === "string" && server.endpoint === "https://gitmcp.io/docs") {
        findings.push({
          record_type: "policy:mcp_validation",
          severity: "warning",
          confidence: "high",
          diagnostic: "Fallback docs endpoint is configured as an approved evidence source.",
          source_path: getMcpServersPath(),
          recommended_action:
            "Use exact repo-form GitMCP endpoints in mcp/servers.json instead of the docs fallback endpoint.",
        });
      }
    }
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }

  findings.push(...(await validateRuntimeMcpPolicyFile({ activeProfile })));

  return findings;
}

export async function scanExposureProfile(profile = "baseline") {
  const allowedProfiles = new Set(["baseline", "project", "deep"]);
  if (!allowedProfiles.has(profile)) {
    throw new Error(`Unsupported exposure scan profile: ${profile}`);
  }

  const lockfileFindings = await scanLockfilePackageExposure();
  let manifestFindings = [];
  if (profile !== "baseline") {
    try {
      const manifestPath = path.join(getRepoRoot(), "package.json");
      manifestFindings = scanPackageExposureFromManifest(await readJson(manifestPath), {
        sourcePath: manifestPath,
        catalog: advisoryCatalog,
      });
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
        throw error;
      }
    }
  }
  const policyFindings =
    profile === "baseline" ? [] : await validateMcpPolicyExposure({ activeProfile: profile });
  const findings = [...lockfileFindings, ...manifestFindings, ...policyFindings];

  return {
    record_type: "exposure_profile_report",
    profile,
    read_only: true,
    mutates_release_state: false,
    findings,
    blocker_count: findings.filter((finding) =>
      ["critical", "high"].includes(`${finding.severity}`.toLowerCase()),
    ).length,
    scanned_surfaces:
      profile === "baseline"
        ? ["package-lock.json"]
        : profile === "project"
          ? [
              "package-lock.json",
              "package.json",
              "mcp/local-capabilities.json",
              "mcp/servers.json",
              ".ma/.mcp.json",
            ]
          : [
              "package-lock.json",
              "package.json",
              "mcp/local-capabilities.json",
              "mcp/servers.json",
              ".ma/.mcp.json",
              "policy",
            ],
  };
}
