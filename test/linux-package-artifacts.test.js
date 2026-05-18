import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  getDebArtifactName,
  getPackArtifactName,
  getPacmanArtifactName,
  getRpmArtifactName,
} from "../scripts/linux-package-lib.mjs";

const repoRoot = process.cwd();
const pkg = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf8"));
const version = pkg.version;

test("Linux package artifact naming stays stable for release wiring", () => {
  assert.equal(getDebArtifactName("0.1.12"), "meta-architect_0.1.12_all.deb");
  assert.equal(getPacmanArtifactName("0.1.12"), "meta-architect-0.1.12-1-any.pkg.tar.xz");
  assert.equal(getRpmArtifactName("0.1.12"), "meta-architect-0.1.12-1.noarch.rpm");
  assert.equal(getPackArtifactName("@jstn-sdk/ma", "0.1.12"), "jstn-sdk-ma-0.1.12.tgz");
});

test("release asset validation requires the Linux package artifact set", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "meta-architect-release-assets-"));
  const distRoot = path.join(tempRoot, "dist");
  await fs.mkdir(distRoot, { recursive: true });
  await fs.writeFile(
    path.join(tempRoot, "package.json"),
    `${JSON.stringify({ name: "@jstn-sdk/ma", version }, null, 2)}\n`,
  );
  await fs.writeFile(path.join(distRoot, "meta-architect-skills.tgz"), "bundle");
  await fs.writeFile(path.join(distRoot, getDebArtifactName(version)), "deb");
  await fs.writeFile(path.join(distRoot, getPacmanArtifactName(version)), "pacman");
  await fs.writeFile(path.join(distRoot, getRpmArtifactName(version)), "rpm");
  await fs.writeFile(path.join(distRoot, "linux-package-manifest.json"), '{\n  "ok": true\n}\n');

  const success = spawnSync(
    process.execPath,
    [path.join(repoRoot, ".github", "scripts", "validate-release-assets.js")],
    {
      cwd: tempRoot,
      encoding: "utf8",
    },
  );
  assert.equal(success.status, 0, success.stderr || success.stdout);

  await fs.rm(path.join(distRoot, getRpmArtifactName(version)));
  const failure = spawnSync(
    process.execPath,
    [path.join(repoRoot, ".github", "scripts", "validate-release-assets.js")],
    {
      cwd: tempRoot,
      encoding: "utf8",
    },
  );
  assert.notEqual(failure.status, 0);
});
