import { createHash } from "node:crypto";
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

export async function loadRedactionVaultOrDefault() {
  try {
    return await readJson(getRedactionVaultPath());
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return createDefaultVault();
    }

    throw error;
  }
}

export async function seedRedactionVault() {
  await writeFileIfMissing(
    getRedactionVaultPath(),
    `${JSON.stringify(createDefaultVault(), null, 2)}\n`,
  );
}

export async function saveRedactionVault(vault) {
  await writeJson(getRedactionVaultPath(), vault);
  return vault;
}

async function appendRedactionEvent({ replacementCount, metadata }) {
  await appendMaestroEvent({
    record_type: "privacy:redaction_applied",
    gate: metadata.gate ?? "$maestro",
    target: metadata.kind ?? "provider-bound-context",
    replacement_count: replacementCount,
  });
}

export function maskSensitiveText(rawText) {
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
    sanitizedText,
    replacements,
  };
}

export async function redactProviderBoundText(rawText, metadata = {}) {
  const vault = await loadRedactionVaultOrDefault();
  const { sanitizedText, replacements } = maskSensitiveText(rawText);

  if (replacements.length === 0) {
    return {
      sanitizedText,
      replacements,
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
    replacements,
  };
}

function redactPayloadValue(value, replacements) {
  if (typeof value === "string") {
    const result = maskSensitiveText(value);
    replacements.push(...result.replacements);
    return result.sanitizedText;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactPayloadValue(item, replacements));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, redactPayloadValue(entry, replacements)]),
    );
  }

  return value;
}

export async function redactProviderBoundPayload(payload, metadata = {}) {
  const vault = await loadRedactionVaultOrDefault();
  const replacements = [];
  const sanitizedPayload = redactPayloadValue(payload, replacements);

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
    replacements,
    redaction_receipt: {
      record_type: "redaction_receipt",
      replacement_count: replacements.length,
      provider_safe: true,
      raw_values_stored_locally: replacements.length > 0,
    },
  };
}
