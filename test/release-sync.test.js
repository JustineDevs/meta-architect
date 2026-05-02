import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const repoRoot = process.cwd();

function bumpPatch(version) {
  const [major, minor, patch] = version.split(".").map(Number);
  return `${major}.${minor}.${patch + 1}`;
}

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (
      entry.name === ".git" ||
      entry.name === "node_modules" ||
      entry.name === ".ma" ||
      entry.name === ".claude" ||
      entry.name === ".agents"
    ) {
      continue;
    }

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

test("release-sync bumps patch and rewrites the active release surfaces", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "meta-architect-release-sync-"));
  await copyDir(repoRoot, tempRoot);
  const pkgBefore = JSON.parse(await fs.readFile(path.join(tempRoot, "package.json"), "utf8"));
  const nextVersion = bumpPatch(pkgBefore.version);
  const currentQaPath = path.join(
    tempRoot,
    "docs",
    "qa",
    `release-readiness-${pkgBefore.version}.md`,
  );
  const nextQaPath = path.join(tempRoot, "docs", "qa", `release-readiness-${nextVersion}.md`);

  const result = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "release-sync.js")], {
    cwd: tempRoot,
    env: {
      ...process.env,
      RELEASE_SYNC_CHANGED_FILES: "README.md",
    },
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const pkgAfter = JSON.parse(await fs.readFile(path.join(tempRoot, "package.json"), "utf8"));
  assert.equal(pkgAfter.version, nextVersion);
  await fs.access(nextQaPath);
  await fs.access(path.join(tempRoot, "plugins", "meta-architect", ".app.json"));
  const releaseText = await fs.readFile(path.join(tempRoot, "RELEASE.md"), "utf8");
  assert.match(releaseText, new RegExp(`@jstn-sdk/ma@${nextVersion}`));
  assert.match(releaseText, new RegExp(`v${nextVersion}`));
  await assert.rejects(() => fs.access(currentQaPath));
});

test("release-sync --force bumps even without detected file changes", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "meta-architect-release-force-"));
  await copyDir(repoRoot, tempRoot);
  const pkgBefore = JSON.parse(await fs.readFile(path.join(tempRoot, "package.json"), "utf8"));
  const nextVersion = bumpPatch(pkgBefore.version);

  const result = spawnSync(
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
