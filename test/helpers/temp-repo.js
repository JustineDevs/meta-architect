import {
  copyProjectFixture,
  createTestNamespace,
  removeTestNamespace,
} from "../../src/test-fixtures.js";

export { copyProjectFixture };

export async function createTempRepo(prefix, repoRoot) {
  const tempRoot = createTestNamespace(prefix);
  await copyProjectFixture(repoRoot, tempRoot);
  return tempRoot;
}

export async function cleanupTempRepo(tempRoot) {
  await removeTestNamespace(tempRoot);
}
