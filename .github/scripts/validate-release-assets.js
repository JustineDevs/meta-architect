#!/usr/bin/env node

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

for (const artifact of artifacts) {
  if (!fs.existsSync(artifact)) {
    console.error(`Missing artifact: ${artifact}`);
    process.exit(1);
  }

  const stat = fs.statSync(artifact);
  if (stat.size <= 0) {
    console.error(`Artifact is empty: ${artifact}`);
    process.exit(1);
  }

  console.log(`${artifact} ok (${stat.size} bytes)`);
}
