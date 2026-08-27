#!/usr/bin/env node

import process from "node:process";
import { installSkills, rollbackInstalledAssets } from "../src/skill-installer.js";

function parseArgs(argv) {
  const args = { path: null, rollback: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--path") {
      args.path = argv[index + 1];
      index += 1;
    }
    if (token === "--rollback") args.rollback = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.rollback) {
    console.log(
      JSON.stringify(await rollbackInstalledAssets({ targetRoot: args.path ?? undefined })),
    );
    return;
  }
  const { installed } = await installSkills({ targetRoot: args.path ?? undefined });
  for (const skill of installed) {
    console.log(`installed ${skill.name} -> ${skill.dest}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
