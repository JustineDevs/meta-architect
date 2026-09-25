import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const PROVIDER_ENV_KEYS = [
  "MAESTRO_DECISION_PROVIDER",
  "TYPESAFE_API_KEY",
  "TYPESAFE_ENDPOINT",
  "TYPESAFE_DEFAULT_MODEL",
  "TYPESAFE_TIMEOUT_MS",
];

const GLOBAL_CONFIG_DIR = "meta-architect";
const GLOBAL_CONFIG_FILE = "provider.env";

function unquote(value) {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed.at(-1);
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return first === '"'
        ? trimmed.slice(1, -1).replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\\\/g, "\\")
        : trimmed.slice(1, -1);
    }
  }
  return trimmed.replace(/\s+#.*$/, "").trim();
}

export function parseProviderEnv(content) {
  const values = {};
  for (const line of String(content ?? "").split(/\r?\n/)) {
    const candidate = line.trim();
    if (!candidate || candidate.startsWith("#")) continue;
    const match = candidate.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match || !PROVIDER_ENV_KEYS.includes(match[1])) continue;
    values[match[1]] = unquote(match[2]);
  }
  return values;
}

function selectedValues(env) {
  return Object.fromEntries(
    PROVIDER_ENV_KEYS.filter((key) => Object.hasOwn(env, key)).map((key) => [key, env[key]]),
  );
}

export function getProviderEnvPath({ home = os.homedir(), env = process.env } = {}) {
  const configHome = env.XDG_CONFIG_HOME || path.join(home, ".config");
  return path.join(configHome, GLOBAL_CONFIG_DIR, GLOBAL_CONFIG_FILE);
}

async function readEnvFile(filePath, { requiredMode = false } = {}) {
  let content;
  try {
    content = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return { values: {}, present: false, path: filePath };
    throw error;
  }
  const stat = await fs.stat(filePath);
  if (requiredMode && (stat.mode & 0o077) !== 0) {
    throw new Error(
      `Refusing insecure Meta-Architect provider config permissions at ${filePath}; run chmod 600 on the file`,
    );
  }
  return { values: parseProviderEnv(content), present: true, path: filePath };
}

export async function resolveProviderEnvironment({
  cwd = process.cwd(),
  home = os.homedir(),
  env = process.env,
} = {}) {
  const globalFile = await readEnvFile(getProviderEnvPath({ home, env }), { requiredMode: true });
  const projectFiles = [];
  for (const name of [".env", ".env.local"]) {
    const file = await readEnvFile(path.join(cwd, name));
    projectFiles.push(file);
  }

  const resolved = {
    ...globalFile.values,
    ...projectFiles[0].values,
    ...projectFiles[1].values,
    ...selectedValues(env),
  };
  return {
    env: resolved,
    sources: {
      global: globalFile.present ? globalFile.path : null,
      project: projectFiles.filter((file) => file.present).map((file) => file.path),
    },
  };
}

export async function getProviderConfigStatus(options = {}) {
  const resolved = await resolveProviderEnvironment(options);
  return {
    configured: Boolean(resolved.env.TYPESAFE_API_KEY),
    provider: resolved.env.MAESTRO_DECISION_PROVIDER ?? "jev",
    model: resolved.env.TYPESAFE_DEFAULT_MODEL ?? "jev-latest",
    sources: resolved.sources,
  };
}

export async function saveProviderCredentials({
  apiKey,
  home = os.homedir(),
  env = process.env,
} = {}) {
  const value = String(apiKey ?? "").trim();
  if (!value) throw new Error("A non-empty TypeSafe API key is required");
  if (/\r|\n/.test(value)) throw new Error("The TypeSafe API key must be a single line");

  const target = getProviderEnvPath({ home, env });
  const directory = path.dirname(target);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await fs.chmod(directory, 0o700);
  const temporary = `${target}.tmp-${randomUUID()}`;
  try {
    await fs.writeFile(
      temporary,
      `# Meta-Architect provider credentials. This file is owner-readable only.\nTYPESAFE_API_KEY=${value}\n`,
      { mode: 0o600, flag: "wx" },
    );
    await fs.chmod(temporary, 0o600);
    await fs.rename(temporary, target);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
  return target;
}

export async function clearProviderCredentials(options = {}) {
  const target = getProviderEnvPath(options);
  await fs.rm(target, { force: true });
  return target;
}
