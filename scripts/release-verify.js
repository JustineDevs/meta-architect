#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { validateReleaseIssueGates } from "../src/release-issue-gates.js";

const CANONICAL_PACKAGE = "@jstn-sdk/ma";
const CANONICAL_INSTALL = "npm i -g @openai/codex@latest @jstn-sdk/ma@latest";
const CDN_INSTALL =
  "curl -fsSL https://cdn.jsdelivr.net/gh/JustineDevs/meta-architect@main/scripts/install.sh | sh";
const CANONICAL_LAUNCH = "ma --madmax --high";
const UNINSTALL_MA = "npm uninstall -g @jstn-sdk/ma";
const UNINSTALL_BOTH = "npm uninstall -g @jstn-sdk/ma @openai/codex";

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
  if (!content.includes(CANONICAL_INSTALL) && !content.includes(CDN_INSTALL)) {
    return;
  }

  assert(content.includes(CDN_INSTALL), `${file}: missing jsDelivr POSIX installer command`);
  assert(content.includes(CANONICAL_INSTALL), `${file}: missing canonical npm install command`);
  assert(content.includes(CANONICAL_LAUNCH), `${file}: missing canonical launch command`);
  assert(content.includes(UNINSTALL_MA), `${file}: missing uninstall Meta-Architect command`);
  assert(
    content.includes(UNINSTALL_BOTH),
    `${file}: missing uninstall Meta-Architect + Codex command`,
  );
}

function verifyNpmIgnore() {
  assert(fs.existsSync(".npmignore"), ".npmignore: missing production package ignore file");
  const content = readText(".npmignore");
  for (const requiredPattern of [
    ".ma/",
    ".omx/",
    "node_modules/",
    ".npm-cache/",
    "dist/",
    "test/",
    ".github/",
    "*.tgz",
  ]) {
    assert(
      content.includes(requiredPattern),
      `.npmignore: missing required production ignore pattern ${requiredPattern}`,
    );
  }
}

function verifyDemoDoc({ version, gitTag }) {
  assert(fs.existsSync("DEMO.md"), "DEMO.md: missing demo guide");
  const content = readText("DEMO.md");
  assert(content.includes(`Release line: \`${gitTag}\``), "DEMO.md: wrong release line");
  assert(content.includes("Package: `@jstn-sdk/ma`"), "DEMO.md: missing package name");
  assert(content.includes(CDN_INSTALL), "DEMO.md: missing jsDelivr installer");
  assert(content.includes(CANONICAL_INSTALL), "DEMO.md: missing canonical npm install");
  assert(content.includes(CANONICAL_LAUNCH), "DEMO.md: missing canonical launch");
  assert(content.includes(UNINSTALL_MA), "DEMO.md: missing MA uninstall command");
  assert(content.includes(UNINSTALL_BOTH), "DEMO.md: missing MA + Codex uninstall command");
  assert(content.includes("npm run release:check"), "DEMO.md: missing full release demo command");
  assert(
    content.includes("Learning Loop Core") || content.includes("learning loop"),
    "DEMO.md: missing learning loop coverage",
  );
  assert(content.includes("Obsidian"), "DEMO.md: missing Obsidian coverage");
  assert(content.includes("Ralph"), "DEMO.md: missing Ralph execution coverage");
  assert(content.includes("data/clone-data.proof.json"), "DEMO.md: missing clone-data proof");
  assert(content.includes("COVERAGE.md"), "DEMO.md: missing coverage artifact");
  assert(content.includes(`version line is \`${version}\``), "DEMO.md: missing current version");
}

function verifyCoverageDoc({ version, gitTag }) {
  assert(fs.existsSync("COVERAGE.md"), "COVERAGE.md: missing coverage matrix");
  const content = readText("COVERAGE.md");
  assert(content.includes(`Target release: \`${gitTag}\``), "COVERAGE.md: wrong target release");
  assert(
    content.includes(`Package: \`@jstn-sdk/ma@${version}\``),
    "COVERAGE.md: wrong package version",
  );
  assert(content.includes("Learning Loop Core"), "COVERAGE.md: missing learning-loop coverage");
  assert(
    content.includes("Helper Orchestration Core"),
    "COVERAGE.md: missing helper orchestration coverage",
  );
  assert(
    content.includes("Environment Awareness Core"),
    "COVERAGE.md: missing environment awareness coverage",
  );
  assert(
    content.includes("Universal Plugin Broker Core"),
    "COVERAGE.md: missing universal plugin broker coverage",
  );
  assert(content.includes("Obsidian Integration Core"), "COVERAGE.md: missing Obsidian coverage");
  assert(content.includes("Ralph Execution Core"), "COVERAGE.md: missing Ralph coverage");
  assert(content.includes("36/36 passing"), "COVERAGE.md: missing current test count");
  assert(
    content.includes("This repository is not a toy demo."),
    "COVERAGE.md: missing truth statement",
  );
  assert(!content.includes("@jstn-sdk/ma@0.1.0"), "COVERAGE.md: stale npm package version");
  assert(!content.includes("v0.1.0 release bar"), "COVERAGE.md: stale release bar");
}

function verifyReadmeReleaseBanner({ gitTag }) {
  const content = readText("README.md");
  assert(
    content.includes("> [!IMPORTANT]"),
    "README.md: missing release-line important admonition",
  );
  assert(
    content.includes(`> Meta-Architect \`${gitTag}\` is a production-grade skills line.`),
    "README.md: stale production-grade skills line version",
  );
  assert(
    content.includes(
      `> From \`${gitTag}\` onward, the package is expected to ship with stable skill contracts, deterministic packaging, explicit release gates, and honest install and publish surfaces.`,
    ),
    "README.md: stale release expectation version",
  );
  assert(
    content.includes(`<td><code>${gitTag}</code></td>`),
    "README.md: stale release line table version",
  );

  const bannerVersions = [
    ...content.matchAll(
      /(?:Meta-Architect `(v[0-9]+\.[0-9]+\.[0-9]+(?:-[^`]+)?)` is a production-grade skills line|From `(v[0-9]+\.[0-9]+\.[0-9]+(?:-[^`]+)?)` onward)/g,
    ),
  ]
    .map((match) => match[1] ?? match[2])
    .filter(Boolean);
  assert(bannerVersions.length >= 2, "README.md: release banner versions not found");
  for (const bannerVersion of bannerVersions) {
    assert(
      bannerVersion === gitTag,
      `README.md: release banner version drift: expected ${gitTag}, got ${bannerVersion}`,
    );
  }
}

function verifyRealDemoKit() {
  const runbook = readText(path.join("docs", "demo", "REAL_DEMO_RUNBOOK.md"));
  const story = readText(path.join("docs", "demo", "DEMO_STORY.md"));
  const checklist = readText(path.join("docs", "demo", "PROSPECT_CHECKLIST.md"));
  assert(fs.existsSync(path.join("scripts", "demo-smoke.js")), "scripts/demo-smoke.js: missing");
  assert(
    runbook.includes("npm run demo:smoke"),
    "REAL_DEMO_RUNBOOK.md: missing demo smoke command",
  );
  assert(runbook.includes("$maestro"), "REAL_DEMO_RUNBOOK.md: missing maestro scenario");
  assert(
    runbook.includes("vault_context"),
    "REAL_DEMO_RUNBOOK.md: missing Obsidian context boundary",
  );
  assert(story.includes("Northstar Logistics"), "DEMO_STORY.md: missing realistic buyer story");
  assert(story.includes("npm run release:verify"), "DEMO_STORY.md: missing release proof close");
  assert(
    checklist.includes("Remove `Demo Account`, `Test Company`, `Sample Co`"),
    "PROSPECT_CHECKLIST.md: missing no-test-branding check",
  );
  for (const forbidden of ["Demo Account", "Test Company", "Sample Co"]) {
    assert(
      !runbook.includes(forbidden) && !story.includes(forbidden),
      `demo docs: forbidden visible demo branding ${forbidden}`,
    );
  }
}

function verifyCanonicalSemanticSurfaces({ version, gitTag }) {
  const usageWorkflow = readText(path.join("example", "usage-workflow.md"));
  assert(
    usageWorkflow.includes(`$maestro I want to harden Meta-Architect ${gitTag}`),
    "example/usage-workflow.md: missing current $maestro release-hardening scenario",
  );
  for (const requiredTerm of ["Obsidian", "Ralph", "Caveman", "learning-loop"]) {
    assert(
      usageWorkflow.includes(requiredTerm),
      `example/usage-workflow.md: missing ${requiredTerm} semantic-core term`,
    );
  }
  for (const staleTerm of [
    "Build a demo",
    "demo app",
    "collaborative whiteboard",
    "smart contract security review",
    "Timeline: 4 weeks",
    "Delivery plan for v0.1.0",
    "@jstn-sdk/ma@0.1.0",
  ]) {
    assert(
      !usageWorkflow.includes(staleTerm),
      `example/usage-workflow.md: stale current-facing term ${staleTerm}`,
    );
  }

  const mission = readText(path.join("missions", "collaborative-whiteboard", "mission.md"));
  assert(
    mission.includes("# Mission: Semantic Release Hardening"),
    "missions/collaborative-whiteboard/mission.md: stale mission title",
  );
  assert(
    mission.includes("Obsidian is core vault-context infrastructure"),
    "missions/collaborative-whiteboard/mission.md: missing Obsidian core mission contract",
  );
  assert(
    mission.includes("Ralph is the execution loop"),
    "missions/collaborative-whiteboard/mission.md: missing Ralph core mission contract",
  );
  assert(
    !mission.toLowerCase().includes("real-time collaborative whiteboard"),
    "missions/collaborative-whiteboard/mission.md: stale whiteboard mission text",
  );

  const currentQa = readText(path.join("docs", "qa", `release-readiness-${version}.md`));
  assert(
    currentQa.includes(`Harden Meta-Architect ${gitTag} semantic core`),
    `docs/qa/release-readiness-${version}.md: missing realistic semantic smoke idea`,
  );
  assert(
    !currentQa.includes('ma idea "Build a demo app"'),
    `docs/qa/release-readiness-${version}.md: stale demo-app helper path`,
  );

  const archPrompt = readText(path.join("prompts", "architect.md"));
  assert(
    !archPrompt.includes("v0.1.0` skills library"),
    "prompts/architect.md: stale v0.1.0 skills-library wording",
  );
  assert(
    archPrompt.includes("current Meta-Architect skills library"),
    "prompts/architect.md: missing current library wording",
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
  assert(pkg.files?.includes("DEMO.md"), "package.json: files must include DEMO.md");
  assert(pkg.files?.includes("COVERAGE.md"), "package.json: files must include COVERAGE.md");

  verifyNpmIgnore();
  verifyDemoDoc({ version, gitTag });
  verifyCoverageDoc({ version, gitTag });
  verifyReadmeReleaseBanner({ gitTag });
  verifyRealDemoKit();
  verifyCanonicalSemanticSurfaces({ version, gitTag });

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

  const issueGatesPath = path.join("docs", "qa", `release-issue-gates-${version}.json`);
  assert(fs.existsSync(issueGatesPath), `Missing release issue gate file: ${issueGatesPath}`);
  const issueGates = validateReleaseIssueGates(readJson(issueGatesPath), {
    version,
    requirePassed: true,
  });
  assert(
    issueGates.valid,
    `${issueGatesPath}: release issue gates are not production-passed\n- ${issueGates.errors.join("\n- ")}`,
  );

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
    "DEMO.md",
    "COVERAGE.md",
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
