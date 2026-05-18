import path from "node:path";

export const LINUX_PACKAGE_NAME = "meta-architect";
export const LINUX_PACKAGE_REVISION = "1";

export function getPackArtifactName(packageName, version) {
  return `${packageName.replace(/^@/, "").replace("/", "-")}-${version}.tgz`;
}

export function getPackArtifactPath(distRoot, packageName, version) {
  return path.join(distRoot, getPackArtifactName(packageName, version));
}

export function getDebArtifactName(version) {
  return `${LINUX_PACKAGE_NAME}_${version}_all.deb`;
}

export function getDebArtifactPath(distRoot, version) {
  return path.join(distRoot, getDebArtifactName(version));
}

export function getPacmanArtifactName(version) {
  return `${LINUX_PACKAGE_NAME}-${version}-${LINUX_PACKAGE_REVISION}-any.pkg.tar.xz`;
}

export function getPacmanArtifactPath(distRoot, version) {
  return path.join(distRoot, getPacmanArtifactName(version));
}

export function getRpmArtifactName(version) {
  return `${LINUX_PACKAGE_NAME}-${version}-${LINUX_PACKAGE_REVISION}.noarch.rpm`;
}

export function getRpmArtifactPath(distRoot, version) {
  return path.join(distRoot, getRpmArtifactName(version));
}

export function getLinuxPackageManifestPath(distRoot) {
  return path.join(distRoot, "linux-package-manifest.json");
}
