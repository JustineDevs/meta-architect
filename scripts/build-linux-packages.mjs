#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createTestNamespace } from "../src/test-fixtures.js";
import {
  getDebArtifactPath,
  getLinuxPackageManifestPath,
  getPackArtifactPath,
  getPacmanArtifactPath,
  getRpmArtifactPath,
  LINUX_PACKAGE_NAME,
  LINUX_PACKAGE_REVISION,
} from "./linux-package-lib.mjs";

const repoRoot = process.cwd();
const distRoot = path.join(repoRoot, "dist");
const packageJson = JSON.parse(await fsp.readFile(path.join(repoRoot, "package.json"), "utf8"));
const version = packageJson.version;
const packageName = packageJson.name;
const maintainer = packageJson.author;
const homepage = packageJson.homepage;
const description = packageJson.description;

function fail(message) {
  throw new Error(message);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: "pipe",
    ...options,
  });
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.status !== 0) {
    fail(`${command} ${args.join(" ")} failed with status ${result.status ?? 1}`);
  }
}

async function copyDir(src, dest) {
  await fsp.mkdir(dest, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fsp.copyFile(srcPath, destPath);
    }
  }
}

async function writeExecutable(filePath, content) {
  await fsp.writeFile(filePath, content, { mode: 0o755 });
  await fsp.chmod(filePath, 0o755);
}

async function getInstalledSizeBytes(root) {
  let total = 0;
  const entries = await fsp.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      total += await getInstalledSizeBytes(entryPath);
      continue;
    }
    const stat = await fsp.stat(entryPath);
    total += stat.size;
  }
  return total;
}

async function createCommonRoot(root, packArtifactPath) {
  const libRoot = path.join(root, "usr", "lib", LINUX_PACKAGE_NAME);
  const binRoot = path.join(root, "usr", "bin");
  await fsp.mkdir(libRoot, { recursive: true });
  await fsp.mkdir(binRoot, { recursive: true });
  run("tar", ["-xzf", packArtifactPath, "-C", libRoot, "--strip-components=1", "package"], {
    cwd: repoRoot,
  });
  const agentCompatSource = path.join(repoRoot, "node_modules", "@jstn-sdk", "agents");
  const agentCompatTarget = path.join(libRoot, "node_modules", "@jstn-sdk", "agents");
  await fsp.access(agentCompatSource);
  await copyDir(agentCompatSource, agentCompatTarget);

  const wrapper = `#!/bin/sh
PREFIX="\${META_ARCHITECT_PREFIX:-}"
NODE_BIN="\${META_ARCHITECT_NODE_BIN:-node}"
if ! command -v "$NODE_BIN" >/dev/null 2>&1; then
  echo "meta-architect requires nodejs >= 20 on the host system." >&2
  exit 127
fi
if ! command -v git >/dev/null 2>&1; then
  echo "meta-architect requires git on the host system." >&2
  exit 127
fi
exec "$NODE_BIN" "\${PREFIX}/usr/lib/${LINUX_PACKAGE_NAME}/bin/ma.js" "$@"
`;
  await writeExecutable(path.join(binRoot, "ma"), wrapper);
  await writeExecutable(path.join(binRoot, "meta-architect"), wrapper);
}

async function buildDeb(commonRoot, artifactPath) {
  const debRoot = `${commonRoot}-deb`;
  await fsp.rm(debRoot, { recursive: true, force: true });
  await copyDir(commonRoot, debRoot);
  const controlRoot = path.join(debRoot, "DEBIAN");
  await fsp.mkdir(controlRoot, { recursive: true });
  await fsp.writeFile(
    path.join(controlRoot, "control"),
    `Package: ${LINUX_PACKAGE_NAME}
Version: ${version}
Section: devel
Priority: optional
Architecture: all
Maintainer: ${maintainer}
Depends: nodejs (>= 20), git
Description: ${description}
 Meta-Architect installs the Codex-native Meta-Architect workflow surface
 without requiring npm package installation first.
Homepage: ${homepage}
`,
  );
  await fsp.rm(artifactPath, { force: true });
  run("dpkg-deb", ["--root-owner-group", "--build", debRoot, artifactPath], { cwd: repoRoot });
}

async function buildPacman(commonRoot, artifactPath) {
  const pacmanRoot = `${commonRoot}-pacman`;
  await fsp.rm(pacmanRoot, { recursive: true, force: true });
  await copyDir(commonRoot, pacmanRoot);
  const installedSize = await getInstalledSizeBytes(path.join(pacmanRoot, "usr"));
  const buildDate = Math.floor(Date.now() / 1000);
  await fsp.writeFile(
    path.join(pacmanRoot, ".PKGINFO"),
    `pkgname = ${LINUX_PACKAGE_NAME}
pkgbase = ${LINUX_PACKAGE_NAME}
pkgver = ${version}-${LINUX_PACKAGE_REVISION}
pkgdesc = ${description}
url = ${homepage}
builddate = ${buildDate}
packager = ${maintainer}
size = ${installedSize}
arch = any
license = MIT
depend = nodejs
depend = git
`,
  );
  await fsp.writeFile(
    path.join(pacmanRoot, ".BUILDINFO"),
    `format = 2
pkgname = ${LINUX_PACKAGE_NAME}
pkgbase = ${LINUX_PACKAGE_NAME}
pkgver = ${version}-${LINUX_PACKAGE_REVISION}
pkgarch = any
packager = ${maintainer}
builddate = ${buildDate}
`,
  );
  await fsp.rm(artifactPath, { force: true });
  run(
    "tar",
    [
      "--sort=name",
      "--mtime=@0",
      "--owner=0",
      "--group=0",
      "--numeric-owner",
      "-cJf",
      artifactPath,
      "-C",
      pacmanRoot,
      ".PKGINFO",
      ".BUILDINFO",
      "usr",
    ],
    { cwd: repoRoot },
  );
}

async function buildRpm(commonRoot, artifactPath) {
  const rpmRoot = `${commonRoot}-rpmbuild`;
  const topDir = path.join(rpmRoot, "topdir");
  for (const dirName of ["BUILD", "BUILDROOT", "RPMS", "SOURCES", "SPECS", "SRPMS", "TMP", "DB"]) {
    await fsp.mkdir(path.join(topDir, dirName), { recursive: true });
  }

  const sourceRootName = `${LINUX_PACKAGE_NAME}-${version}`;
  const sourceRoot = path.join(rpmRoot, sourceRootName);
  await fsp.rm(sourceRoot, { recursive: true, force: true });
  await copyDir(commonRoot, sourceRoot);
  const sourceTarPath = path.join(topDir, "SOURCES", `${sourceRootName}.tar.gz`);
  run("tar", ["-czf", sourceTarPath, "-C", rpmRoot, sourceRootName], { cwd: repoRoot });

  const specPath = path.join(topDir, "SPECS", `${LINUX_PACKAGE_NAME}.spec`);
  await fsp.writeFile(
    specPath,
    `Name: ${LINUX_PACKAGE_NAME}
Version: ${version}
Release: ${LINUX_PACKAGE_REVISION}%{?dist}
Summary: ${description}
License: MIT
URL: ${homepage}
BuildArch: noarch
Requires: nodejs >= 20
Requires: git
Source0: %{name}-%{version}.tar.gz

%description
Meta-Architect installs the Codex-native Meta-Architect workflow surface
without requiring npm package installation first.

%prep
%setup -q

%build

%install
rm -rf %{buildroot}
mkdir -p %{buildroot}
cp -a usr %{buildroot}/

%files
/usr/bin/ma
/usr/bin/meta-architect
/usr/lib/${LINUX_PACKAGE_NAME}
`,
  );

  await fsp.rm(artifactPath, { force: true });
  run(
    "rpmbuild",
    [
      "--define",
      `_topdir ${topDir}`,
      "--define",
      `_tmppath ${path.join(topDir, "TMP")}`,
      "--define",
      `_dbpath ${path.join(topDir, "DB")}`,
      "-bb",
      specPath,
    ],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        HOME: rpmRoot,
        TMPDIR: path.join(topDir, "TMP"),
        QA_RPATHS: "0x0000",
      },
    },
  );
  const builtRpmPath = path.join(topDir, "RPMS", "noarch", path.basename(artifactPath));
  await fsp.copyFile(builtRpmPath, artifactPath);
}

async function main() {
  if (process.platform !== "linux") {
    fail("Native Linux package builds are supported only on Linux hosts");
  }

  await fsp.mkdir(distRoot, { recursive: true });
  const packArtifactPath = getPackArtifactPath(distRoot, packageName, version);
  await fsp.rm(packArtifactPath, { force: true });
  run(
    "npm",
    [
      "pack",
      ".",
      "--ignore-scripts",
      "--cache",
      path.join(distRoot, ".npm-cache"),
      "--pack-destination",
      distRoot,
    ],
    { cwd: repoRoot },
  );

  const workRoot = createTestNamespace("meta-architect-linux-packages");
  const commonRoot = path.join(workRoot, "root");
  await createCommonRoot(commonRoot, packArtifactPath);

  const debArtifactPath = getDebArtifactPath(distRoot, version);
  const pacmanArtifactPath = getPacmanArtifactPath(distRoot, version);
  const rpmArtifactPath = getRpmArtifactPath(distRoot, version);
  await buildDeb(commonRoot, debArtifactPath);
  await buildPacman(commonRoot, pacmanArtifactPath);
  await buildRpm(commonRoot, rpmArtifactPath);

  await fsp.writeFile(
    getLinuxPackageManifestPath(distRoot),
    `${JSON.stringify(
      {
        version,
        packageName,
        linuxPackageName: LINUX_PACKAGE_NAME,
        revision: LINUX_PACKAGE_REVISION,
        artifacts: {
          deb: path.basename(debArtifactPath),
          pacman: path.basename(pacmanArtifactPath),
          rpm: path.basename(rpmArtifactPath),
        },
        install: {
          debian: `sudo apt install ./${path.basename(debArtifactPath)}`,
          arch: `sudo pacman -U ./${path.basename(pacmanArtifactPath)}`,
          rpm: `sudo dnf install ./${path.basename(rpmArtifactPath)}`,
        },
      },
      null,
      2,
    )}\n`,
  );

  console.log(debArtifactPath);
  console.log(pacmanArtifactPath);
  console.log(rpmArtifactPath);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
