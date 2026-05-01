#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const manifestPath = path.join("skills", "index.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const skillDirs = fs
  .readdirSync("skills", { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const normalizedManifestDirs = manifest.skills
  .map((entry) => entry.path.replace(/^skills\//, ""))
  .sort();

if (JSON.stringify(skillDirs) !== JSON.stringify(normalizedManifestDirs)) {
  console.error("skills/index.json does not match skills/* directories");
  console.error("dirs:", skillDirs);
  console.error("manifest:", normalizedManifestDirs);
  process.exit(1);
}

console.log("skills/index.json matches skill directories");
