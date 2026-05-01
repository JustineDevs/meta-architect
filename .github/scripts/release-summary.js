#!/usr/bin/env node

import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const artifact = fs.existsSync("dist/meta-architect-skills.tgz");

console.log(
  JSON.stringify(
    {
      name: pkg.name,
      version: pkg.version,
      artifactBuilt: artifact,
    },
    null,
    2,
  ),
);
