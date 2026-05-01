#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const CANONICAL_PACKAGE = "@jstn-sdk/meta-architect";
const CANONICAL_INSTALL = "npm i -g @openai/codex@latest @jstn-sdk/meta-architect@latest";
const CANONICAL_LAUNCH = "ma --madmax --high";
const UNINSTALL_MA = "npm uninstall -g @jstn-sdk/meta-architect";
const UNINSTALL_BOTH = "npm uninstall -g @jstn-sdk/meta-architect @openai/codex";

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readText(file) {
  return fs.readFileSync(file, "utf8");
}

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function parseVersion(version) {
  const match = version.match(
    /^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)(?:-(?<prerelease>[0-9A-Za-z.-]+))?$/,
  );
  if (!match?.groups) {
    fail(`Invalid package version: ${version}`);
  }
  return match.groups;
}

function verifyInstallBlock(file) {
  const content = readText(file);
  if (!content.includes(CANONICAL_INSTALL)) {
    return;
  }

  assert(content.includes(CANONICAL_LAUNCH), `${file}: missing canonical launch command`);
  assert(content.includes(UNINSTALL_MA), `${file}: missing uninstall Meta-Architect command`);
  assert(
    content.includes(UNINSTALL_BOTH),
    `${file}: missing uninstall Meta-Architect + Codex command`,
  );
}

function main() {
  const pkg = readJson("package.json");
  const lock = readJson("package-lock.json");
  const version = pkg.version;
  const gitTag = `v${version}`;
  const parsed = parseVersion(version);
  const isPrerelease = Boolean(parsed.prerelease);

  assert(pkg.name === CANONICAL_PACKAGE, "package.json: wrong package name");
  assert(lock.name === CANONICAL_PACKAGE, "package-lock.json: wrong package name");
  assert(lock.version === version, "package-lock.json: version drift from package.json");
  assert(lock.packages?.[""]?.version === version, "package-lock.json: root package version drift");
  assert(
    pkg.publishConfig?.access === "public",
    "package.json: publishConfig.access must be public",
  );

  const changelog = readText("CHANGELOG.md");
  assert(changelog.includes(`## ${gitTag}`), "CHANGELOG.md: missing current version heading");

  const release = readText("RELEASE.md");
  assert(release.includes(`# Meta-Architect ${gitTag}`), "RELEASE.md: wrong title version");

  const releaseSpec = readText(path.join("docs", "release-spec.md"));
  assert(
    releaseSpec.includes(`# ${gitTag} Requirements & Rules`),
    "docs/release-spec.md: wrong title version",
  );
  assert(
    releaseSpec.includes(`package.json\` version \`${version}\``) ||
      releaseSpec.includes(`package.json\` version \`${version}`),
    "docs/release-spec.md: missing package version reference",
  );
  assert(
    releaseSpec.includes(`git tag \`${gitTag}\``),
    "docs/release-spec.md: missing git tag reference",
  );

  const qaPath = path.join("docs", "qa", `release-readiness-${version}.md`);
  assert(fs.existsSync(qaPath), `Missing QA release-readiness file: ${qaPath}`);
  const qa = readText(qaPath);
  assert(qa.includes(`# Release Readiness ${version}`), `${qaPath}: wrong title version`);

  const pluginApp = readJson(path.join("plugins", "meta-architect", ".app.json"));
  const pluginMcp = readJson(path.join("plugins", "meta-architect", ".mcp.json"));
  const pluginManifest = readJson(
    path.join("plugins", "meta-architect", ".codex-plugin", "plugin.json"),
  );
  assert(pluginApp.version === version, "plugins/meta-architect/.app.json: version drift");
  assert(pluginMcp.version === version, "plugins/meta-architect/.mcp.json: version drift");
  assert(
    pluginManifest.version === version,
    "plugins/meta-architect/.codex-plugin/plugin.json: version drift",
  );

  for (const file of [
    "README.md",
    path.join("docs", "getting-started.md"),
    path.join("docs", "onboarding.md"),
    path.join("docs", "skills.md"),
    path.join("plugins", "meta-architect", "README.md"),
  ]) {
    verifyInstallBlock(file);
  }

  const envTag =
    process.env.RELEASE_TAG || process.env.GITHUB_REF_NAME || process.env.GIT_TAG || "";
  if (envTag.startsWith("v")) {
    assert(envTag === gitTag, `Release tag mismatch: expected ${gitTag}, got ${envTag}`);
  }

  if (isPrerelease) {
    const prereleaseTag = parsed.prerelease.split(".")[0];
    assert(
      prereleaseTag && prereleaseTag !== "latest",
      `Prerelease version ${version} must resolve to an explicit non-latest dist-tag`,
    );
  }

  console.log(
    JSON.stringify(
      {
        name: pkg.name,
        version,
        gitTag,
        isPrerelease,
      },
      null,
      2,
    ),
  );
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
