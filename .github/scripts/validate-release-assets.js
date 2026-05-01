#!/usr/bin/env node

import fs from "node:fs";

const artifact = "dist/meta-architect-skills.tgz";
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
