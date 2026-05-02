#!/usr/bin/env node

import process from "node:process";
import { installSkills } from "../src/skill-installer.js";

function parseArgs(argv) {
  const args = { path: null };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--path") {
      args.path = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { installed } = await installSkills({ targetRoot: args.path ?? undefined });
  for (const skill of installed) {
    console.log(`installed ${skill.name} -> ${skill.dest}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
