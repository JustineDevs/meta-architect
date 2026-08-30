#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { buildPlugins, supportedPluginTargets } from "./plugin-build.js";

const repoRoot = process.cwd();
const output = path.join(repoRoot, "dist", "vendor-plugins");
const publishers = {};

function parseArgs(argv) {
  const targets = [];
  let execute = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--target" || arg === "--targets") {
      targets.push(...(argv[index + 1] ?? "").split(",").filter(Boolean));
      index += 1;
    } else if (arg === "--execute") {
      execute = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: npm run plugin:publish -- --target pi [--execute]");
      process.exit(0);
    }
  }
  if (targets.length !== 1) throw new Error("plugin:publish requires exactly one --target");
  if (targets[0] === "all")
    throw new Error("Publishing all hosts at once is unsafe; publish one target at a time");
  if (!supportedPluginTargets.includes(targets[0]))
    throw new Error(`Unknown plugin target: ${targets[0]}`);
  return { target: targets[0], execute };
}

async function main() {
  const { target, execute } = parseArgs(process.argv.slice(2));
  const [targetRoot] = await buildPlugins({ output, targets: [target] });
  const publisher = publishers[target];
  if (!publisher) {
    console.log(
      JSON.stringify(
        {
          target,
          status: "prepared",
          path: targetRoot,
          next: "Commit the generated directory to the host marketplace or repository required by this host.",
        },
        null,
        2,
      ),
    );
    return;
  }

  if (!execute) {
    console.log(
      JSON.stringify(
        {
          target,
          status: "dry-run",
          path: targetRoot,
          command: [publisher.command, ...publisher.args].join(" "),
        },
        null,
        2,
      ),
    );
    return;
  }

  execFileSync(publisher.command, publisher.args, { cwd: targetRoot, stdio: "inherit" });
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
