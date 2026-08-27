import { ensureDir, readJson, writeFileIfMissing, writeJson } from "../fs-utils.js";
import { getRuntimeSubsystemPath } from "../paths.js";
import { maskSensitiveText } from "./redaction-gateway.js";

const scopes = ["user-local", "project-shared", "session-only"];
const precedence = ["session-only", "project-shared", "user-local"];

export function getPreferencesPath() {
  return getRuntimeSubsystemPath("memory", "preferences.json");
}

export function createDefaultPreferences() {
  return { schemaVersion: "0.1.0", preferences: {} };
}

export async function seedPreferences() {
  await ensureDir(getRuntimeSubsystemPath("memory"));
  await writeFileIfMissing(
    getPreferencesPath(),
    `${JSON.stringify(createDefaultPreferences(), null, 2)}\n`,
  );
}

function sanitize(value) {
  if (typeof value === "string") return maskSensitiveText(value).sanitizedText;
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitize(item)]));
  }
  return value;
}

export async function loadPreferences() {
  return readJson(getPreferencesPath()).catch(() => createDefaultPreferences());
}

export async function setPreference(key, value, { scope = "project-shared" } = {}) {
  if (!key || !scopes.includes(scope)) throw new Error(`Unsupported preference scope: ${scope}`);
  const current = await loadPreferences();
  const next = {
    ...current,
    preferences: {
      ...current.preferences,
      [key]: { ...(current.preferences?.[key] ?? {}), [scope]: sanitize(value) },
    },
  };
  await writeJson(getPreferencesPath(), next);
  return next.preferences[key];
}

export async function clearPreference(key, { scope } = {}) {
  const current = await loadPreferences();
  if (!current.preferences?.[key]) return false;
  const next = { ...current, preferences: { ...current.preferences } };
  if (scope) {
    if (!scopes.includes(scope)) throw new Error(`Unsupported preference scope: ${scope}`);
    next.preferences[key] = { ...next.preferences[key] };
    delete next.preferences[key][scope];
    if (Object.keys(next.preferences[key]).length === 0) delete next.preferences[key];
  } else delete next.preferences[key];
  await writeJson(getPreferencesPath(), next);
  return true;
}

export async function listPreferences() {
  return (await loadPreferences()).preferences;
}

export async function resolvePreferences() {
  const stored = await listPreferences();
  return Object.fromEntries(
    Object.entries(stored).map(([key, values]) => {
      const scope = precedence.find((candidate) => values?.[candidate] !== undefined);
      return [key, scope ? { value: values[scope], scope } : null];
    }),
  );
}

export { scopes as preferenceScopes };
