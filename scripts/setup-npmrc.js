#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function normalizeRegistry(registryUrl) {
  return registryUrl.endsWith("/") ? registryUrl : `${registryUrl}/`;
}

async function main() {
  const token = process.env.NPM_TOKEN || process.env.NODE_AUTH_TOKEN;
  if (!token) {
    console.log("No npm token detected. Skipping .npmrc generation.");
    return;
  }

  const registry = normalizeRegistry(process.env.NPM_REGISTRY_URL || "https://registry.npmjs.org/");
  const scope = process.env.NPM_SCOPE || "";
  const host = new URL(registry).host;
  const npmrcPath = path.join(process.cwd(), ".npmrc");

  const content = [
    `registry=${registry}`,
    ...(scope ? [`${scope}:registry=${registry}`] : []),
    `//${host}/:_authToken=${token}`,
    "",
  ].join("\n");

  await fs.writeFile(npmrcPath, content, "utf8");
  console.log(
    `Wrote CI .npmrc for ${scope ? `scope ${scope}` : "the canonical unscoped package"}.`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
