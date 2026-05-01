#!/usr/bin/env node

import fs from "node:fs";

const checks = [
  ["package.json", fs.existsSync("package.json")],
  ["skills/index.json", fs.existsSync("skills/index.json")],
  ["dist/meta-architect-skills.tgz", fs.existsSync("dist/meta-architect-skills.tgz")],
  [".codex/hooks.json", fs.existsSync(".codex/hooks.json")],
  [".ma/decisions.json", fs.existsSync(".ma/decisions.json")],
  [".ma/release.json", fs.existsSync(".ma/release.json")],
  ["docs/release-spec.md", fs.existsSync("docs/release-spec.md")],
  ["plugins/meta-architect/.app.json", fs.existsSync("plugins/meta-architect/.app.json")],
  [
    "missions/collaborative-whiteboard/mission.md",
    fs.existsSync("missions/collaborative-whiteboard/mission.md"),
  ],
  ["prompts/architect.md", fs.existsSync("prompts/architect.md")],
];

let failures = 0;
for (const [label, ok] of checks) {
  if (ok) {
    console.log(`[OK] ${label}`);
  } else {
    console.log(`[MISSING] ${label}`);
    failures += 1;
  }
}

process.exitCode = failures === 0 ? 0 : 1;
