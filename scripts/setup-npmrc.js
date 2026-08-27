#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export async function createTemporaryNpmConfig({
  token,
  registry = "https://registry.npmjs.org/",
  scope = "",
  tempRoot = process.env.RUNNER_TEMP || os.tmpdir(),
} = {}) {
  if (!token) return null;
  const normalizedRegistry = registry.endsWith("/") ? registry : `${registry}/`;
  const host = new URL(normalizedRegistry).host;
  const configPath = path.join(tempRoot, `meta-architect-npmrc-${randomUUID()}`);
  const content = [
    `registry=${normalizedRegistry}`,
    ...(scope ? [`${scope}:registry=${normalizedRegistry}`] : []),
    `//${host}/:_authToken=${token}`,
    "",
  ].join("\n");

  await fs.writeFile(configPath, content, { encoding: "utf8", mode: 0o600 });
  await fs.chmod(configPath, 0o600);
  return configPath;
}

export async function cleanupTemporaryNpmConfig(configPath) {
  if (!configPath) return false;
  await fs.rm(configPath, { force: true });
  return true;
}

async function main() {
  const token = process.env.NPM_TOKEN || process.env.NODE_AUTH_TOKEN;
  if (!token) {
    console.log("No npm token detected. Skipping temporary npm auth config.");
    return;
  }

  const configPath = await createTemporaryNpmConfig({
    token,
    registry: process.env.NPM_REGISTRY_URL || "https://registry.npmjs.org/",
    scope: process.env.NPM_SCOPE || "",
  });
  if (process.env.GITHUB_ENV) {
    await fs.appendFile(process.env.GITHUB_ENV, `NPM_CONFIG_USERCONFIG=${configPath}\n`);
  }
  console.log("Created temporary npm auth config outside the workspace.");
  if (!process.env.GITHUB_ENV) {
    console.log(`Use NPM_CONFIG_USERCONFIG=${configPath} for the current command.`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
