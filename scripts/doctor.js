#!/usr/bin/env node

import fs from "node:fs";
import {
  getDebArtifactName,
  getPacmanArtifactName,
  getRpmArtifactName,
} from "./linux-package-lib.mjs";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

const checks = [
  ["package.json", fs.existsSync("package.json")],
  ["skills/index.json", fs.existsSync("skills/index.json")],
  ["dist/meta-architect-skills.tgz", fs.existsSync("dist/meta-architect-skills.tgz")],
  [
    `dist/${getDebArtifactName(pkg.version)}`,
    fs.existsSync(`dist/${getDebArtifactName(pkg.version)}`),
  ],
  [
    `dist/${getPacmanArtifactName(pkg.version)}`,
    fs.existsSync(`dist/${getPacmanArtifactName(pkg.version)}`),
  ],
  [
    `dist/${getRpmArtifactName(pkg.version)}`,
    fs.existsSync(`dist/${getRpmArtifactName(pkg.version)}`),
  ],
  [".codex/hooks.json", fs.existsSync(".codex/hooks.json")],
  [".ma/decisions.json", fs.existsSync(".ma/decisions.json")],
  [".ma/release.json", fs.existsSync(".ma/release.json")],
  [
    ".ma/context/helper-orchestration-core.json",
    fs.existsSync(".ma/context/helper-orchestration-core.json"),
  ],
  [
    ".ma/context/environment-awareness-core.json",
    fs.existsSync(".ma/context/environment-awareness-core.json"),
  ],
  [
    ".ma/context/universal-plugin-broker-core.json",
    fs.existsSync(".ma/context/universal-plugin-broker-core.json"),
  ],
  ["docs/release-spec.md", fs.existsSync("docs/release-spec.md")],
  ["DEMO.md", fs.existsSync("DEMO.md")],
  ["COVERAGE.md", fs.existsSync("COVERAGE.md")],
  ["data/clone-data.proof.json", fs.existsSync("data/clone-data.proof.json")],
  ["data/clone-data.ledger.json", fs.existsSync("data/clone-data.ledger.json")],
  ["data/clone-data.rvf", fs.existsSync("data/clone-data.rvf")],
  [".agents/plugins/marketplace.json", fs.existsSync(".agents/plugins/marketplace.json")],
  ["plugins/meta-architect/.app.json", fs.existsSync("plugins/meta-architect/.app.json")],
  [
    "plugins/meta-architect/.codex-plugin/plugin.json",
    fs.existsSync("plugins/meta-architect/.codex-plugin/plugin.json"),
  ],
  ["plugins/meta-architect/.mcp.json", fs.existsSync("plugins/meta-architect/.mcp.json")],
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
