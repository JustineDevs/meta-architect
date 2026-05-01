#!/usr/bin/env node

import fs from "node:fs";
import process from "node:process";

function loadPackageJson() {
  return JSON.parse(fs.readFileSync("package.json", "utf8"));
}

function parseVersion(version) {
  const match = version.match(
    /^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)(?:-(?<prerelease>[0-9A-Za-z.-]+))?$/,
  );
  if (!match?.groups) {
    throw new Error(`Invalid package.json version: ${version}`);
  }
  return match.groups;
}

function computeMetadata(version) {
  const parsed = parseVersion(version);
  const prerelease = parsed.prerelease ?? "";
  const prereleaseIdentifiers = prerelease ? prerelease.split(".") : [];
  const isPrerelease = prereleaseIdentifiers.length > 0;
  const distTag = isPrerelease ? prereleaseIdentifiers[0] : "latest";

  return {
    version,
    gitTag: `v${version}`,
    isPrerelease,
    distTag,
    prerelease,
  };
}

function parseArgs(argv) {
  const args = {
    field: "",
    githubOutput: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--field") {
      args.field = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--github-output") {
      args.githubOutput = argv[index + 1] ?? "";
      index += 1;
    }
  }

  return args;
}

function writeGithubOutput(outputPath, metadata) {
  const lines = [
    `version=${metadata.version}`,
    `git_tag=${metadata.gitTag}`,
    `dist_tag=${metadata.distTag}`,
    `is_prerelease=${metadata.isPrerelease}`,
  ];
  fs.appendFileSync(outputPath, `${lines.join("\n")}\n`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const pkg = loadPackageJson();
  const metadata = computeMetadata(pkg.version);

  if (args.githubOutput) {
    writeGithubOutput(args.githubOutput, metadata);
  }

  if (args.field) {
    const value = metadata[args.field];
    if (value === undefined) {
      throw new Error(`Unknown metadata field: ${args.field}`);
    }
    console.log(value);
    return;
  }

  console.log(JSON.stringify(metadata, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
