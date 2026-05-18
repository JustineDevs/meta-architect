#!/usr/bin/env node

import fs from "node:fs";
import {
  getDebArtifactName,
  getPacmanArtifactName,
  getRpmArtifactName,
} from "../../scripts/linux-package-lib.mjs";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const artifact = fs.existsSync("dist/meta-architect-skills.tgz");
const debArtifact = fs.existsSync(`dist/${getDebArtifactName(pkg.version)}`);
const pacmanArtifact = fs.existsSync(`dist/${getPacmanArtifactName(pkg.version)}`);
const rpmArtifact = fs.existsSync(`dist/${getRpmArtifactName(pkg.version)}`);

console.log(
  JSON.stringify(
    {
      name: pkg.name,
      version: pkg.version,
      artifactBuilt: artifact,
      linuxDebBuilt: debArtifact,
      linuxPacmanBuilt: pacmanArtifact,
      linuxRpmBuilt: rpmArtifact,
    },
    null,
    2,
  ),
);
