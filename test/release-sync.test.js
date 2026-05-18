import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { spawnPortable } from "./helpers/spawn-portable.js";
import { createTempRepo } from "./helpers/temp-repo.js";

const repoRoot = process.cwd();

function bumpPatch(version) {
  const [major, minor, patch] = version.split(".").map(Number);
  return `${major}.${minor}.${patch + 1}`;
}

test("release-sync bumps patch and rewrites the active release surfaces", async () => {
  const tempRoot = await createTempRepo("meta-architect-release-sync-", repoRoot);
  const pkgBefore = JSON.parse(await fs.readFile(path.join(tempRoot, "package.json"), "utf8"));
  const nextVersion = bumpPatch(pkgBefore.version);
  const currentQaPath = path.join(
    tempRoot,
    "docs",
    "qa",
    `release-readiness-${pkgBefore.version}.md`,
  );
  const nextQaPath = path.join(tempRoot, "docs", "qa", `release-readiness-${nextVersion}.md`);

  const result = spawnPortable(
    process.execPath,
    [path.join(repoRoot, "scripts", "release-sync.js")],
    {
      cwd: tempRoot,
      env: {
        ...process.env,
        RELEASE_SYNC_CHANGED_FILES: "README.md",
      },
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const pkgAfter = JSON.parse(await fs.readFile(path.join(tempRoot, "package.json"), "utf8"));
  assert.equal(pkgAfter.version, nextVersion);
  await fs.access(nextQaPath);
  await fs.access(path.join(tempRoot, "plugins", "meta-architect", ".app.json"));
  const pluginManifest = await fs.readFile(
    path.join(tempRoot, "plugins", "meta-architect", ".codex-plugin", "plugin.json"),
    "utf8",
  );
  const releaseText = await fs.readFile(path.join(tempRoot, "RELEASE.md"), "utf8");
  assert.match(releaseText, new RegExp(`@jstn-sdk/ma@${nextVersion}`));
  assert.match(releaseText, new RegExp(`v${nextVersion}`));
  assert.match(
    pluginManifest,
    /"keywords": \["codex", "skills", "architecture", "workflow", "review"\]/,
  );
  await assert.rejects(() => fs.access(currentQaPath));
});

test("release-sync --force bumps even without detected file changes", async () => {
  const tempRoot = await createTempRepo("meta-architect-release-force-", repoRoot);
  const pkgBefore = JSON.parse(await fs.readFile(path.join(tempRoot, "package.json"), "utf8"));
  const nextVersion = bumpPatch(pkgBefore.version);

  const result = spawnPortable(
    process.execPath,
    [path.join(repoRoot, "scripts", "release-sync.js"), "--force", "--bump", "patch"],
    {
      cwd: tempRoot,
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const pkgAfter = JSON.parse(await fs.readFile(path.join(tempRoot, "package.json"), "utf8"));
  assert.equal(pkgAfter.version, nextVersion);
});
