import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { createTempRepo } from "./helpers/temp-repo.js";

const repoRoot = process.cwd();

test("lockfile exposure scan reports known vulnerable package versions", async () => {
  const tempRoot = await createTempRepo("meta-architect-exposure-", repoRoot);
  const previousRoot = process.env.MA_ROOT;
  process.env.MA_ROOT = tempRoot;

  try {
    await fs.writeFile(
      path.join(tempRoot, "package-lock.json"),
      `${JSON.stringify(
        {
          name: "fixture",
          lockfileVersion: 3,
          packages: {
            "": {
              name: "fixture",
              version: "1.0.0",
            },
            "node_modules/tar": {
              version: "6.1.11",
            },
          },
        },
        null,
        2,
      )}\n`,
    );

    const exposureCatalog = await import(
      `${pathToFileURL(path.join(repoRoot, "src", "runtime", "exposure-catalog.js")).href}?t=${Date.now()}`
    );

    const findings = await exposureCatalog.scanLockfilePackageExposure();
    assert.equal(findings.length, 1);
    assert.equal(findings[0].record_type, "finding:package_exposure");
    assert.equal(findings[0].package_name, "tar");
    assert.equal(findings[0].severity, "critical");

    const genericFindings = exposureCatalog.scanPackageExposureFromLockfile(
      {
        packages: {
          "node_modules/example": {
            version: "1.0.0",
          },
        },
      },
      {
        sourcePath: "fixture-lock.json",
        catalog: [
          {
            ecosystem: "npm",
            packageName: "example",
            vulnerableBelow: "2.0.0",
            severity: "high",
            confidence: "medium",
            diagnostic: "example < 2.0.0 is unsafe.",
            recommendedAction: "Upgrade example.",
            advisoryReference: "fixture-advisory",
          },
        ],
      },
    );
    assert.equal(genericFindings.length, 1);
    assert.equal(genericFindings[0].source_path, "fixture-lock.json");
    assert.equal(genericFindings[0].severity, "high");

    const manifestFindings = exposureCatalog.scanPackageExposureFromManifest(
      {
        dependencies: {
          example: "^1.2.3",
        },
      },
      {
        sourcePath: "package.json",
        catalog: [
          {
            ecosystem: "npm",
            packageName: "example",
            vulnerableBelow: "2.0.0",
            severity: "high",
            confidence: "medium",
            diagnostic: "example < 2.0.0 is unsafe.",
            recommendedAction: "Upgrade example.",
            advisoryReference: "fixture-advisory",
          },
        ],
      },
    );
    assert.equal(manifestFindings.length, 1);
    assert.equal(manifestFindings[0].evidence_kind, "manifest-version-range-match");
    assert.equal(manifestFindings[0].normalized_version, "1.2.3");

    const report = await exposureCatalog.scanExposureProfile("baseline");
    assert.equal(report.record_type, "exposure_profile_report");
    assert.equal(report.profile, "baseline");
    assert.equal(report.read_only, true);
    assert.equal(report.mutates_release_state, false);
    assert.equal(report.scanned_surfaces.includes("package-lock.json"), true);

    const projectReport = await exposureCatalog.scanExposureProfile("project");
    assert.equal(projectReport.scanned_surfaces.includes("package.json"), true);
  } finally {
    if (previousRoot === undefined) {
      delete process.env.MA_ROOT;
    } else {
      process.env.MA_ROOT = previousRoot;
    }
  }
});
