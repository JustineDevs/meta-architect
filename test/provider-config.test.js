import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  clearProviderCredentials,
  getProviderConfigStatus,
  getProviderEnvPath,
  parseProviderEnv,
  resolveProviderEnvironment,
  saveProviderCredentials,
} from "../src/runtime/provider-config.js";

async function tempRoot(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ma-provider-config-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test("provider dotenv parsing accepts comments, export syntax, and quoted values", () => {
  assert.deepEqual(
    parseProviderEnv(
      `export TYPESAFE_API_KEY="jv_live_test"\nTYPESAFE_TIMEOUT_MS=15000 # bounded\nOTHER=ignored`,
    ),
    { TYPESAFE_API_KEY: "jv_live_test", TYPESAFE_TIMEOUT_MS: "15000" },
  );
});

test("provider configuration precedence is explicit env, .env.local, .env, then global", async (t) => {
  const root = await tempRoot(t);
  const home = path.join(root, "home");
  const project = path.join(root, "project");
  await fs.mkdir(path.join(home, ".config", "meta-architect"), { recursive: true });
  await fs.mkdir(project, { recursive: true });
  await fs.writeFile(
    getProviderEnvPath({ home, env: {} }),
    "TYPESAFE_API_KEY=global\nTYPESAFE_DEFAULT_MODEL=global-model\n",
    { mode: 0o600 },
  );
  await fs.writeFile(path.join(project, ".env"), "TYPESAFE_API_KEY=project\n");
  await fs.writeFile(path.join(project, ".env.local"), "TYPESAFE_API_KEY=local\n");

  const fromFiles = await resolveProviderEnvironment({ cwd: project, home, env: {} });
  assert.equal(fromFiles.env.TYPESAFE_API_KEY, "local");
  assert.equal(fromFiles.env.TYPESAFE_DEFAULT_MODEL, "global-model");

  const fromExplicitEnv = await resolveProviderEnvironment({
    cwd: project,
    home,
    env: { TYPESAFE_API_KEY: "process" },
  });
  assert.equal(fromExplicitEnv.env.TYPESAFE_API_KEY, "process");
});

test("global credentials are owner-only and status never exposes the key", async (t) => {
  const root = await tempRoot(t);
  const home = path.join(root, "home");
  const env = { XDG_CONFIG_HOME: path.join(root, "config") };
  const target = await saveProviderCredentials({ apiKey: "jv_live_secret", home, env });
  const stat = await fs.stat(target);
  assert.equal(stat.mode & 0o077, 0);

  const status = await getProviderConfigStatus({ cwd: root, home, env });
  assert.equal(status.configured, true);
  assert.deepEqual(status.sources.global, target);
  assert.doesNotMatch(JSON.stringify(status), /jv_live_secret/);

  await clearProviderCredentials({ home, env });
  assert.equal((await getProviderConfigStatus({ cwd: root, home, env })).configured, false);
});

test("insecure global credentials fail closed", async (t) => {
  const root = await tempRoot(t);
  const home = path.join(root, "home");
  const target = getProviderEnvPath({ home, env: {} });
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, "TYPESAFE_API_KEY=insecure\n", { mode: 0o644 });
  await assert.rejects(
    resolveProviderEnvironment({ cwd: root, home, env: {} }),
    /Refusing insecure Meta-Architect provider config permissions/,
  );
});
