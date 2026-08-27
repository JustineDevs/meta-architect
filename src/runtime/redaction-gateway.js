import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { readJson, writeFileIfMissing, writeJson } from "../fs-utils.js";
import { getRuntimeStatePath } from "../paths.js";
import { appendMaestroEvent } from "./maestro-events.js";

const redactionRules = [
  {
    placeholderBase: "__MA_SECURE_CONN_DB__",
    regex: /postgres:\/\/[^\s"'`]+/gi,
  },
  {
    placeholderBase: "__MA_SECURE_CRYPTO_KEY__",
    regex: /-----BEGIN PRIVATE KEY-----[\s\S]+?-----END PRIVATE KEY-----/g,
  },
  {
    placeholderBase: "__MA_ANONYMOUS_IDENTITY__",
    regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
  },
  {
    placeholderBase: "__MA_SECURE_TOKEN__",
    regex:
      /\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{16,}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z-_]{20,})\b/g,
  },
  {
    placeholderBase: "__MA_SECURE_ASSIGNMENT__",
    regex:
      /\b(?:API_KEY|API_TOKEN|AUTH_TOKEN|SECRET_KEY|DATABASE_URL|PRIVATE_KEY|PASSWORD)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
  },
];

export function getRedactionVaultPath() {
  return getRuntimeStatePath("redaction-vault.json");
}

function createDefaultVault() {
  return {
    schemaVersion: "0.1.0",
    entries: {},
  };
}

export function getRedactionVaultPolicy() {
  const retentionDays = Number.parseInt(process.env.MA_REDACTION_VAULT_RETENTION_DAYS ?? "30", 10);
  const maxEntries = Number.parseInt(process.env.MA_REDACTION_VAULT_MAX_ENTRIES ?? "200", 10);
  return {
    retentionDays: Number.isFinite(retentionDays) ? Math.min(Math.max(retentionDays, 1), 3650) : 30,
    maxEntries: Number.isFinite(maxEntries) ? Math.min(Math.max(maxEntries, 1), 10000) : 200,
  };
}

export async function loadRedactionVaultOrDefault() {
  try {
    const vault = await readJson(getRedactionVaultPath());
    const normalized = applyRedactionVaultPolicy(vault);
    if (JSON.stringify(vault) !== JSON.stringify(normalized)) {
      await saveRedactionVault(normalized);
    }
    return normalized;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return createDefaultVault();
    }

    throw error;
  }
}

export async function seedRedactionVault() {
  const vaultPath = getRedactionVaultPath();
  await writeFileIfMissing(
    vaultPath,
    `${JSON.stringify(applyRedactionVaultPolicy(createDefaultVault()), null, 2)}\n`,
  );
  await secureRedactionVaultPermissions(vaultPath);
}

export async function saveRedactionVault(vault) {
  const normalized = applyRedactionVaultPolicy(vault);
  const vaultPath = getRedactionVaultPath();
  await writeJson(vaultPath, normalized);
  await secureRedactionVaultPermissions(vaultPath);
  return normalized;
}

async function secureRedactionVaultPermissions(vaultPath) {
  const directory = path.dirname(vaultPath);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await fs.chmod(directory, 0o700);
  await fs.chmod(vaultPath, 0o600);
}

export async function inspectRedactionVault() {
  const vaultPath = getRedactionVaultPath();
  try {
    const [file, directory] = await Promise.all([
      fs.stat(vaultPath),
      fs.stat(path.dirname(vaultPath)),
    ]);
    const fileMode = file.mode & 0o777;
    const directoryMode = directory.mode & 0o777;
    const issues = [];
    if (fileMode !== 0o600) issues.push(`vault file mode ${fileMode.toString(8)}; expected 600`);
    if (directoryMode !== 0o700) {
      issues.push(`vault directory mode ${directoryMode.toString(8)}; expected 700`);
    }
    return {
      exists: true,
      path: vaultPath,
      status: issues.length > 0 ? "warning" : "ok",
      issues,
      policy: getRedactionVaultPolicy(),
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        exists: false,
        path: vaultPath,
        status: "ok",
        issues: [],
        policy: getRedactionVaultPolicy(),
      };
    }
    throw error;
  }
}

export async function purgeRedactionVault({ dryRun = false } = {}) {
  const vaultPath = getRedactionVaultPath();
  const exists = await fs
    .stat(vaultPath)
    .then(() => true)
    .catch((error) => {
      if (error?.code === "ENOENT") return false;
      throw error;
    });
  if (exists && !dryRun) await fs.rm(vaultPath, { force: true });
  return { status: exists ? (dryRun ? "would-purge" : "purged") : "absent", path: vaultPath };
}

async function appendRedactionEvent({ replacementCount, metadata }) {
  await appendMaestroEvent({
    record_type: "privacy:redaction_applied",
    gate: metadata.gate ?? "$maestro",
    target: metadata.kind ?? "provider-bound-context",
    replacement_count: replacementCount,
  });
}

function maskSensitiveTextInternal(rawText) {
  let sanitizedText = rawText;
  const replacements = [];
  const seen = new Set();

  for (const rule of redactionRules) {
    sanitizedText = sanitizedText.replace(rule.regex, (match) => {
      const digest = createHash("sha256").update(`${rule.placeholderBase}:${match}`).digest("hex");
      const placeholder = `${rule.placeholderBase}_${digest.slice(0, 12)}__`;
      if (!seen.has(placeholder)) {
        replacements.push({
          placeholder,
          rawValue: match,
          placeholderBase: rule.placeholderBase,
        });
        seen.add(placeholder);
      }
      return placeholder;
    });
  }

  return {
    sanitizedText: redactPreviewPaths(sanitizedText),
    replacements,
  };
}

export function maskSensitiveText(rawText) {
  const result = maskSensitiveTextInternal(rawText);
  return {
    sanitizedText: result.sanitizedText,
    replacements: result.replacements.map(publicReplacement),
  };
}

export async function redactProviderBoundText(rawText, metadata = {}) {
  const vault = await loadRedactionVaultOrDefault();
  const { sanitizedText, replacements } = maskSensitiveTextInternal(rawText);

  if (replacements.length === 0) {
    return {
      sanitizedText,
      replacements: replacements.map(publicReplacement),
    };
  }

  for (const replacement of replacements) {
    vault.entries[replacement.placeholder] = {
      rawValue: replacement.rawValue,
      placeholderBase: replacement.placeholderBase,
      createdAt: new Date().toISOString(),
      metadata,
    };
  }

  await saveRedactionVault(vault);
  await appendRedactionEvent({ replacementCount: replacements.length, metadata });
  return {
    sanitizedText,
    replacements: replacements.map(publicReplacement),
  };
}

function redactPayloadValue(value, replacements, seen = new WeakSet()) {
  if (typeof value === "string") {
    const result = maskSensitiveTextInternal(value);
    replacements.push(...result.replacements);
    return redactPreviewPaths(result.sanitizedText);
  }

  if (Array.isArray(value)) {
    return redactObjectValue(value, replacements, seen);
  }

  if (value && typeof value === "object") {
    return redactObjectValue(value, replacements, seen);
  }

  return value;
}

function filterPublicValue(value, classes, seen = new WeakSet()) {
  if (typeof value === "string") {
    if (/(?:[A-Za-z]:\\|\/(?:Users|home|tmp|var|etc|opt|srv|mnt|private)[\\/])/.test(value)) {
      classes.add("local_path");
    }
    return { value, omitted: false };
  }
  if (!value || typeof value !== "object") return { value, omitted: false };
  if (
    ["personal/local", "user-local", "session-only"].includes(value.scope) ||
    (value.freshness?.status === "stale" && !value.provenance && !value.sourceFiles)
  ) {
    classes.add(value.scope ? "private_context" : "stale_without_provenance");
    return { value: undefined, omitted: true };
  }
  if (seen.has(value)) return { value: "[Circular]", omitted: false };
  seen.add(value);
  if (Array.isArray(value)) {
    const result = value
      .map((item) => filterPublicValue(item, classes, seen))
      .filter((item) => !item.omitted)
      .map((item) => item.value);
    seen.delete(value);
    return { value: result, omitted: false };
  }
  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    const filtered = filterPublicValue(entry, classes, seen);
    if (!filtered.omitted) result[key] = filtered.value;
  }
  seen.delete(value);
  return { value: result, omitted: false };
}

function redactObjectValue(value, replacements, seen) {
  if (!value || typeof value !== "object") {
    return value;
  }
  if (seen.has(value)) {
    return "[Circular]";
  }
  seen.add(value);

  if (Array.isArray(value)) {
    const result = value.map((item) =>
      typeof item === "string"
        ? redactPayloadValue(item, replacements, seen)
        : redactObjectValue(item, replacements, seen),
    );
    seen.delete(value);
    return result;
  }

  const result = Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      const redactedEntry =
        typeof entry === "string"
          ? redactPayloadValue(entry, replacements, seen)
          : redactObjectValue(entry, replacements, seen);
      if (typeof redactedEntry === "string" && /(?:preview|excerpt|snippet|path|file)/i.test(key)) {
        return [key, redactPreviewPaths(redactedEntry)];
      }
      return [key, redactedEntry];
    }),
  );
  seen.delete(value);
  return result;
}

function publicReplacement({ placeholder, placeholderBase }) {
  return { placeholder, placeholderBase };
}

export async function redactProviderBoundPayload(payload, metadata = {}) {
  const vault = await loadRedactionVaultOrDefault();
  const replacements = [];
  const classes = new Set();
  const filtered = filterPublicValue(payload, classes).value;
  const sanitizedPayload = redactPayloadValue(filtered, replacements);

  for (const replacement of replacements) {
    vault.entries[replacement.placeholder] = {
      rawValue: replacement.rawValue,
      placeholderBase: replacement.placeholderBase,
      createdAt: new Date().toISOString(),
      metadata,
    };
  }

  if (replacements.length > 0) {
    await saveRedactionVault(vault);
    await appendRedactionEvent({ replacementCount: replacements.length, metadata });
  }

  return {
    sanitizedPayload,
    replacements: replacements.map(publicReplacement),
    redaction_receipt: {
      record_type: "redaction_receipt",
      replacement_count: replacements.length,
      provider_safe: true,
      raw_values_stored_locally: replacements.length > 0,
      redacted_classes: [
        ...classes,
        ...new Set(replacements.map((replacement) => replacement.placeholderBase)),
      ],
    },
  };
}

function redactPreviewPaths(value) {
  return value.replace(
    /(?:[A-Za-z]:\\|\/(?:Users|home|tmp|var|etc|opt|srv|mnt|private)[\\/])(?:[A-Za-z0-9._ -]+[\\/])+[A-Za-z0-9._ -]+(?:\.[A-Za-z0-9._ -]+)?/g,
    "__MA_PATH_REDACTED__",
  );
}

function applyRedactionVaultPolicy(vault) {
  const entries = Object.entries(vault?.entries ?? {});
  entries.sort((left, right) => {
    const leftTime = Date.parse(left[1]?.createdAt ?? "") || 0;
    const rightTime = Date.parse(right[1]?.createdAt ?? "") || 0;
    return rightTime - leftTime;
  });

  const policy = getRedactionVaultPolicy();
  const cutoff = Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000;
  const retainedEntries = entries.filter(([, entry]) => {
    const createdAt = Date.parse(entry?.createdAt ?? "") || 0;
    return createdAt >= cutoff;
  });

  const limitedEntries = retainedEntries.slice(0, policy.maxEntries);
  return {
    ...vault,
    policy: {
      retention_days: policy.retentionDays,
      max_entries: policy.maxEntries,
    },
    entries: Object.fromEntries(limitedEntries),
  };
}
