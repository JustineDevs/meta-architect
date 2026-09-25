#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import {
  assertSupportedSkillInvocation,
  validateLocalMarketplace,
  validatePortablePlugin,
} from "../src/plugin-packaging.js";

const repoRoot = process.cwd();

function parseArgs(argv) {
  const args = {
    plugin: path.join(repoRoot, "plugins", "meta-architect"),
    marketplace: path.join(repoRoot, ".agents", "plugins", "marketplace.json"),
    invocation: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--plugin") args.plugin = path.resolve(argv[++index]);
    else if (token === "--marketplace") args.marketplace = path.resolve(argv[++index]);
    else if (token === "--invocation") args.invocation = argv[++index];
    else if (token === "--help" || token === "-h") {
      console.log(
        "Usage: npm run plugin:validate -- [--plugin DIR] [--marketplace FILE] [--invocation TEXT]",
      );
      process.exit(0);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.invocation) {
    assertSupportedSkillInvocation(args.invocation);
    console.log("skill invocation is portable");
    return;
  }
  const manifest = await validatePortablePlugin(args.plugin);
  await validateLocalMarketplace(args.marketplace, { sourceRoot: repoRoot });
  console.log(`portable plugin is valid: ${manifest.name}@${manifest.version}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
