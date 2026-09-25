#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import process from "node:process";

function run(command, args) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const version = packageJson.version;
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`package.json contains an invalid release version: ${version}`);
}

const tag = `v${version}`;
const head = run("git", ["rev-parse", "HEAD"]);
const remote = process.env.RELEASE_REMOTE ?? "origin";
const dryRun = hasFlag("--dry-run") || process.env.RELEASE_DRY_RUN === "1";
const remoteRefs = run("git", ["ls-remote", remote, `refs/tags/${tag}`, `refs/tags/${tag}^{}`]);
const remoteHashes = remoteRefs
  .split("\n")
  .map((line) => line.split(/\s+/)[0])
  .filter(Boolean);

if (remoteHashes.length > 0) {
  if (remoteHashes.includes(head)) {
    console.log(`${tag} already points at ${head}; nothing to do.`);
    process.exit(0);
  }
  throw new Error(`${tag} already exists on ${remote} but does not point at ${head}`);
}

if (dryRun) {
  console.log(`Would create annotated tag ${tag} at ${head} and push it to ${remote}.`);
  process.exit(0);
}

run("git", ["tag", "-a", tag, head, "-m", `Release ${tag}`]);
try {
  run("git", ["push", remote, tag]);
} catch (error) {
  run("git", ["tag", "-d", tag]);
  throw error;
}
console.log(`Created and pushed ${tag} at ${head}.`);
