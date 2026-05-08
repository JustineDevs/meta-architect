#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const supportedExtensions = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".jsx",
  ".ts",
  ".tsx",
  ".json",
  ".jsonc",
  ".css",
]);

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
}

function getStagedFiles() {
  const result = spawnSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR"], {
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }

  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => supportedExtensions.has(path.extname(file)))
    .filter((file) => fs.existsSync(file));
}

function main() {
  const files = getStagedFiles();
  if (files.length === 0) {
    return;
  }

  run("npx", ["@biomejs/biome", "format", "--write", ...files]);
  run("git", ["update-index", "--again"]);
  run("npx", ["@biomejs/biome", "lint", ...files]);
}

main();
