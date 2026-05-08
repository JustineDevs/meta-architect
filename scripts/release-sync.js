#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const WATCHED_PREFIXES = [
  "bin/",
  "docs/",
  "example/",
  "mcp/",
  "missions/",
  "plugins/",
  "prompts/",
  ".codex/prompts/",
  "sprint/",
  "templates/",
  "src/",
  "skills/",
];

const WATCHED_FILES = new Set([
  "README.md",
  "RELEASE.md",
  "CHANGELOG.md",
  "package.json",
  "package-lock.json",
]);

function parseArgs(argv) {
  const args = {
    bump: "",
    fromRef: "",
    toRef: "",
    githubOutput: "",
    force: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--bump") {
      args.bump = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--from-ref") {
      args.fromRef = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--to-ref") {
      args.toRef = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--github-output") {
      args.githubOutput = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--force") {
      args.force = true;
    }
  }

  return args;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function writePluginManifestJson(file, value) {
  let content = `${JSON.stringify(value, null, 2)}\n`;
  if (Array.isArray(value.keywords)) {
    const inlineKeywords = `[${value.keywords.map((entry) => JSON.stringify(entry)).join(", ")}]`;
    content = content.replace(/"keywords": \[[\s\S]*?\],/, `"keywords": ${inlineKeywords},`);
  }
  fs.writeFileSync(file, content);
}

function readText(file) {
  return fs.readFileSync(file, "utf8");
}

function writeText(file, content) {
  fs.writeFileSync(file, content);
}

function replaceRequired(text, search, replacement, label) {
  if (!text.includes(search)) {
    throw new Error(`Expected to find ${label}: ${search}`);
  }
  return text.replaceAll(search, replacement);
}

function parseVersion(version) {
  const match = version.match(/^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)$/);
  if (!match?.groups) {
    throw new Error(`Unsupported version for release-sync: ${version}`);
  }
  return {
    major: Number(match.groups.major),
    minor: Number(match.groups.minor),
    patch: Number(match.groups.patch),
  };
}

function bumpVersion(version, bumpKind) {
  const parsed = parseVersion(version);
  if (bumpKind === "major") {
    return `${parsed.major + 1}.0.0`;
  }
  if (bumpKind === "minor") {
    return `${parsed.major}.${parsed.minor + 1}.0`;
  }
  return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function getChangedFiles({ fromRef, toRef, force }) {
  if (process.env.RELEASE_SYNC_CHANGED_FILES) {
    return process.env.RELEASE_SYNC_CHANGED_FILES.split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  if (force) {
    return [];
  }

  if (fromRef && toRef && !/^0+$/.test(fromRef)) {
    return git(["diff", "--name-only", fromRef, toRef])
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  return git(["status", "--porcelain"])
    .split("\n")
    .map((line) => line.slice(3).trim())
    .filter(Boolean);
}

function isWatchedPath(file) {
  return WATCHED_FILES.has(file) || WATCHED_PREFIXES.some((prefix) => file.startsWith(prefix));
}

function prependChangelog(version) {
  const changelogPath = "CHANGELOG.md";
  const changelog = readText(changelogPath);
  if (changelog.includes(`## v${version}`)) {
    return;
  }

  const next = changelog.replace(
    "# Changelog\n\n",
    `# Changelog\n\n## v${version}\n\n- Release line prepared automatically for v${version}.\n\n`,
  );
  writeText(changelogPath, next);
}

function updateCurrentSurfaceFile(file, oldVersion, nextVersion) {
  const oldTag = `v${oldVersion}`;
  const nextTag = `v${nextVersion}`;
  const oldQa = `release-readiness-${oldVersion}.md`;
  const nextQa = `release-readiness-${nextVersion}.md`;
  let content = readText(file);
  if (content.includes(oldTag)) {
    content = content.replaceAll(oldTag, nextTag);
  }
  if (content.includes(oldVersion)) {
    content = content.replaceAll(oldVersion, nextVersion);
  }
  content = content.replaceAll(oldQa, nextQa);
  writeText(file, content);
}

function syncPackageVersion(nextVersion) {
  const pkg = readJson("package.json");
  const lock = readJson("package-lock.json");
  pkg.version = nextVersion;
  lock.version = nextVersion;
  if (lock.packages?.[""]) {
    lock.packages[""].version = nextVersion;
  }
  writeJson("package.json", pkg);
  writeJson("package-lock.json", lock);
}

function syncPluginVersions(nextVersion) {
  for (const file of [
    path.join("plugins", "meta-architect", ".app.json"),
    path.join("plugins", "meta-architect", ".mcp.json"),
  ]) {
    const value = readJson(file);
    value.version = nextVersion;
    writeJson(file, value);
  }

  const pluginManifestFile = path.join("plugins", "meta-architect", ".codex-plugin", "plugin.json");
  const pluginManifest = readJson(pluginManifestFile);
  pluginManifest.version = nextVersion;
  writePluginManifestJson(pluginManifestFile, pluginManifest);
}

function syncCurrentReleaseFiles(oldVersion, nextVersion) {
  for (const file of [
    "README.md",
    "RELEASE.md",
    path.join("docs", "README.md"),
    path.join("docs", "getting-started.md"),
    path.join("docs", "release-spec.md"),
    path.join("plugins", "meta-architect", "README.md"),
  ]) {
    updateCurrentSurfaceFile(file, oldVersion, nextVersion);
  }

  const oldQa = path.join("docs", "qa", `release-readiness-${oldVersion}.md`);
  const nextQa = path.join("docs", "qa", `release-readiness-${nextVersion}.md`);
  fs.renameSync(oldQa, nextQa);
  updateCurrentSurfaceFile(nextQa, oldVersion, nextVersion);
}

function syncSupportingCode(oldVersion, nextVersion) {
  const replacements = [
    {
      file: path.join("src", "skills.js"),
      search: `release-readiness-${oldVersion}.md`,
      replacement: `release-readiness-${nextVersion}.md`,
      label: "skills QA path",
    },
    {
      file: path.join("src", "mcp-live-client.js"),
      search: `version: "${oldVersion}"`,
      replacement: `version: "${nextVersion}"`,
      label: "mcp live client version",
    },
    {
      file: path.join("test", "package-install-smoke.test.js"),
      search: `jstn-sdk-ma-${oldVersion}.tgz`,
      replacement: `jstn-sdk-ma-${nextVersion}.tgz`,
      label: "tarball filename",
    },
    {
      file: path.join("test", "policy.test.js"),
      search: `release/${oldVersion}`,
      replacement: `release/${nextVersion}`,
      label: "release branch example",
    },
  ];

  for (const entry of replacements) {
    const content = readText(entry.file);
    writeText(entry.file, replaceRequired(content, entry.search, entry.replacement, entry.label));
  }
}

function rewriteReleaseState(nextVersion, previousVersion) {
  const releasePath = "RELEASE.md";
  const qaPath = path.join("docs", "qa", `release-readiness-${nextVersion}.md`);

  let release = readText(releasePath);
  release = release.replace(
    /- npm package: `@jstn-sdk\/ma@[0-9]+\.[0-9]+\.[0-9]+`/,
    `- npm package: \`@jstn-sdk/ma@${nextVersion}\``,
  );
  release = release.replace(
    /- publishability note: .+/,
    `- publishability note: \`${previousVersion}\` is already published, so \`${nextVersion}\` is the next publishable package line`,
  );
  release = release.replace(
    /- GitHub release: .+/,
    `- GitHub release: pending publish for \`v${nextVersion}\``,
  );
  release = release.replace(
    /- npm publication has not been run yet for `@jstn-sdk\/ma@[0-9]+\.[0-9]+\.[0-9]+`/,
    `- npm publication has not been run yet for \`@jstn-sdk/ma@${nextVersion}\``,
  );
  writeText(releasePath, release);

  let qa = readText(qaPath);
  qa = qa.replace(
    /- npm package: `@jstn-sdk\/ma@[0-9]+\.[0-9]+\.[0-9]+`/,
    `- npm package: \`@jstn-sdk/ma@${nextVersion}\``,
  );
  qa = qa.replace(
    /- publishability note: .+/,
    `- publishability note: \`${previousVersion}\` is already published, so \`${nextVersion}\` is the next publishable package line`,
  );
  qa = qa.replace(
    /- GitHub release: .+/,
    `- GitHub release: pending publish for \`v${nextVersion}\``,
  );
  writeText(qaPath, qa);
}

function writeGithubOutput(outputPath, { updated, version }) {
  const lines = [`updated=${updated}`, `version=${version}`];
  fs.appendFileSync(outputPath, `${lines.join("\n")}\n`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const pkg = readJson("package.json");
  const currentVersion = pkg.version;
  const changedFiles = getChangedFiles(args);
  const relevantChanges = args.force ? ["<forced>"] : changedFiles.filter(isWatchedPath);

  if (relevantChanges.length === 0 && !args.force) {
    if (args.githubOutput) {
      writeGithubOutput(args.githubOutput, { updated: "false", version: currentVersion });
    }
    console.log(
      JSON.stringify(
        {
          updated: false,
          forced: false,
          version: currentVersion,
          changedFiles,
        },
        null,
        2,
      ),
    );
    return;
  }

  const bumpKind = args.bump || "patch";
  const nextVersion = bumpVersion(currentVersion, bumpKind);

  syncPackageVersion(nextVersion);
  syncPluginVersions(nextVersion);
  prependChangelog(nextVersion);
  syncCurrentReleaseFiles(currentVersion, nextVersion);
  syncSupportingCode(currentVersion, nextVersion);
  rewriteReleaseState(nextVersion, currentVersion);

  if (args.githubOutput) {
    writeGithubOutput(args.githubOutput, { updated: "true", version: nextVersion });
  }

  console.log(
    JSON.stringify(
      {
        updated: true,
        forced: args.force,
        bump: bumpKind,
        previousVersion: currentVersion,
        version: nextVersion,
        changedFiles: relevantChanges,
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
