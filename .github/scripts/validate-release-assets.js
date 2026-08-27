#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  getDebArtifactName,
  getPacmanArtifactName,
  getRpmArtifactName,
} from "../../scripts/linux-package-lib.mjs";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const version = pkg.version;
const artifacts = [
  "dist/meta-architect-skills.tgz",
  path.join("dist", getDebArtifactName(version)),
  path.join("dist", getPacmanArtifactName(version)),
  path.join("dist", getRpmArtifactName(version)),
  "dist/linux-package-manifest.json",
];
const metadata = ["dist/SHA256SUMS", "dist/sbom.spdx.json", "dist/release-summary.json"];

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function assertFile(file, label = file) {
  if (!fs.existsSync(file)) throw new Error(`Missing artifact: ${label}`);
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size <= 0)
    throw new Error(`Artifact is empty or not a file: ${label}`);
  if ((stat.mode & 0o111) !== 0) throw new Error(`Artifact must not be executable: ${label}`);
  return stat;
}

function writeMetadata() {
  fs.mkdirSync("dist", { recursive: true });
  for (const artifact of artifacts) assertFile(artifact);
  const checksums = artifacts
    .map((artifact) => `${sha256(artifact)}  ${path.basename(artifact)}`)
    .join("\n");
  fs.writeFileSync("dist/SHA256SUMS", `${checksums}\n`);
  const lock = fs.existsSync("package-lock.json")
    ? JSON.parse(fs.readFileSync("package-lock.json", "utf8"))
    : { packages: {} };
  const packages = Object.entries(lock.packages ?? {})
    .filter(([name]) => name && name !== "")
    .map(([name, value]) => ({
      SPDXID: `SPDXRef-${name.replace(/[^A-Za-z0-9.-]/g, "-")}`,
      name: name.replace(/^node_modules\//, ""),
      versionInfo: value.version ?? "NOASSERTION",
      downloadLocation: "NOASSERTION",
      licenseConcluded: "NOASSERTION",
      licenseDeclared: "NOASSERTION",
    }));
  fs.writeFileSync(
    "dist/sbom.spdx.json",
    `${JSON.stringify(
      {
        SPDXID: "SPDXRef-DOCUMENT",
        spdxVersion: "SPDX-2.3",
        creationInfo: {
          created: new Date().toISOString(),
          creators: ["Tool: meta-architect release-assets"],
        },
        name: `meta-architect-${pkg.version}`,
        dataLicense: "CC0-1.0",
        documentNamespace: `https://github.com/JustineDevs/meta-architect/releases/${pkg.version}`,
        packages,
      },
      null,
      2,
    )}\n`,
  );
  fs.writeFileSync(
    "dist/release-summary.json",
    `${JSON.stringify(
      {
        package: pkg.name,
        version,
        artifacts: artifacts.map((artifact) => ({
          file: path.basename(artifact),
          bytes: fs.statSync(artifact).size,
          sha256: sha256(artifact),
        })),
        metadata,
      },
      null,
      2,
    )}\n`,
  );
}

function validateMetadata() {
  for (const file of metadata) assertFile(file);
  const expected = artifacts
    .map((artifact) => `${sha256(artifact)}  ${path.basename(artifact)}`)
    .join("\n");
  if (fs.readFileSync("dist/SHA256SUMS", "utf8").trim() !== expected)
    throw new Error("dist/SHA256SUMS does not match release artifacts");
  const sbom = JSON.parse(fs.readFileSync("dist/sbom.spdx.json", "utf8"));
  if (sbom.spdxVersion !== "SPDX-2.3" || !Array.isArray(sbom.packages))
    throw new Error("dist/sbom.spdx.json is not a valid SPDX manifest");
  const summary = JSON.parse(fs.readFileSync("dist/release-summary.json", "utf8"));
  if (
    summary.package !== pkg.name ||
    summary.version !== version ||
    summary.artifacts?.length !== artifacts.length
  )
    throw new Error("dist/release-summary.json is inconsistent");
}

if (process.argv.includes("--generate")) {
  try {
    writeMetadata();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

try {
  for (const artifact of artifacts) {
    const stat = assertFile(artifact);
    console.log(`${artifact} ok (${stat.size} bytes, ${sha256(artifact)})`);
  }
  const allowed = new Set([...artifacts, ...metadata]);
  for (const entry of fs.readdirSync("dist")) {
    if (!allowed.has(path.join("dist", entry)))
      throw new Error(`Unexpected release artifact: dist/${entry}`);
  }
  validateMetadata();
  console.log("Release checksums, SBOM, summary, contents, and modes verified.");
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
