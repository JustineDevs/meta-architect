import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { createTempRepo } from "./helpers/temp-repo.js";

const repoRoot = process.cwd();

test("redaction gateway masks sensitive provider-bound text and persists local vault mappings", async () => {
  const tempRoot = await createTempRepo("meta-architect-redaction-", repoRoot);
  const previousRoot = process.env.MA_ROOT;
  process.env.MA_ROOT = tempRoot;

  try {
    const gateway = await import(
      `${pathToFileURL(path.join(repoRoot, "src", "runtime", "redaction-gateway.js")).href}?t=${Date.now()}`
    );

    await gateway.seedRedactionVault();

    const rawText = [
      "Contact developer@meta-architect.io",
      "Use postgres://admin:secret@localhost:5432/prod_db",
      "Token sk-abcdefghijklmnopqrstuvwxyz123456",
      "API_TOKEN=raw-secret-value /home/justine/private/project.txt",
    ].join(" ");

    const result = await gateway.redactProviderBoundText(rawText, {
      kind: "unit-test",
    });
    const secondResult = await gateway.redactProviderBoundText(rawText, {
      kind: "unit-test",
    });

    assert.notEqual(result.sanitizedText, rawText);
    assert.equal(result.sanitizedText, secondResult.sanitizedText);
    assert.equal(result.replacements.length >= 3, true);
    assert.match(result.sanitizedText, /__MA_ANONYMOUS_IDENTITY__/);
    assert.match(result.sanitizedText, /__MA_SECURE_CONN_DB__/);
    assert.match(result.sanitizedText, /__MA_SECURE_TOKEN__/);
    assert.match(result.sanitizedText, /__MA_SECURE_ASSIGNMENT__/);
    assert.doesNotMatch(result.sanitizedText, /raw-secret-value|\/home\/justine/);

    const vault = JSON.parse(
      await fs.readFile(path.join(tempRoot, ".ma", "state", "redaction-vault.json"), "utf8"),
    );
    assert.equal(vault.schemaVersion, "0.1.0");
    assert.equal(Object.keys(vault.entries).length >= 3, true);
    if (process.platform !== "win32") {
      const vaultMode =
        (await fs.stat(path.join(tempRoot, ".ma", "state", "redaction-vault.json"))).mode & 0o777;
      assert.equal(vaultMode, 0o600);
    }

    const payloadResult = await gateway.redactProviderBoundPayload(
      {
        prompt: "Email developer@meta-architect.io",
        url: "https://example.com/api/v1",
        preview:
          "Open /Users/justine/projects/meta-architect/.ma/release.json after https://example.com/api/v1",
        tokens: ["sk-abcdefghijklmnopqrstuvwxyz123456", "developer@meta-architect.io"],
        nested: {
          token: "sk-abcdefghijklmnopqrstuvwxyz123456",
        },
      },
      { kind: "structured-unit-test" },
    );
    assert.match(payloadResult.sanitizedPayload.prompt, /__MA_ANONYMOUS_IDENTITY__/);
    assert.equal(payloadResult.sanitizedPayload.url, "https://example.com/api/v1");
    assert.match(payloadResult.sanitizedPayload.preview, /__MA_PATH_REDACTED__/);
    assert.match(payloadResult.sanitizedPayload.nested.token, /__MA_SECURE_TOKEN__/);
    assert.match(payloadResult.sanitizedPayload.tokens[0], /__MA_SECURE_TOKEN__/);
    assert.match(payloadResult.sanitizedPayload.tokens[1], /__MA_ANONYMOUS_IDENTITY__/);
    assert.equal(payloadResult.redaction_receipt.record_type, "redaction_receipt");
    assert.equal(payloadResult.redaction_receipt.provider_safe, true);
    assert.equal(Array.isArray(payloadResult.redaction_receipt.redacted_classes), true);

    const publicResult = await gateway.redactProviderBoundPayload(
      {
        personal: { scope: "personal/local", value: "private note" },
        stale: { freshness: { status: "stale" }, value: "old fact" },
        shared: { scope: "project-shared", value: "safe note" },
      },
      { kind: "public-artifact-unit-test" },
    );
    assert.equal("personal" in publicResult.sanitizedPayload, false);
    assert.equal("stale" in publicResult.sanitizedPayload, false);
    assert.equal(publicResult.sanitizedPayload.shared.value, "safe note");
    assert.deepEqual(
      publicResult.redaction_receipt.redacted_classes.sort(),
      ["private_context", "stale_without_provenance"].sort(),
    );

    const cyclic = { preview: "See /tmp/meta-architect/.ma/decisions.json" };
    cyclic.self = cyclic;
    const cyclicResult = await gateway.redactProviderBoundPayload(cyclic, {
      kind: "cycle-unit-test",
    });
    assert.equal(cyclicResult.sanitizedPayload.self, "[Circular]");
    assert.match(cyclicResult.sanitizedPayload.preview, /__MA_PATH_REDACTED__/);
    const cyclicArray = [];
    cyclicArray.push(cyclicArray);
    const cyclicArrayResult = await gateway.redactProviderBoundPayload(cyclicArray, {
      kind: "cycle-array-unit-test",
    });
    assert.equal(cyclicArrayResult.sanitizedPayload[0], "[Circular]");

    const eventLines = (
      await fs.readFile(path.join(tempRoot, ".ma", "logs", "maestro-events.ndjson"), "utf8")
    )
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.equal(
      eventLines.filter((event) => event.record_type === "privacy:redaction_applied").length >= 3,
      true,
    );
    assert.equal(
      eventLines.some((event) => JSON.stringify(event).includes("developer@meta-architect.io")),
      false,
    );
  } finally {
    if (previousRoot === undefined) {
      delete process.env.MA_ROOT;
    } else {
      process.env.MA_ROOT = previousRoot;
    }
  }
});

test("redaction vault enforces bounded retention, permissions, and explicit purge", async () => {
  const tempRoot = await createTempRepo("meta-architect-redaction-policy-", repoRoot);
  const previousRoot = process.env.MA_ROOT;
  const previousRetention = process.env.MA_REDACTION_VAULT_RETENTION_DAYS;
  const previousMax = process.env.MA_REDACTION_VAULT_MAX_ENTRIES;
  process.env.MA_ROOT = tempRoot;
  process.env.MA_REDACTION_VAULT_RETENTION_DAYS = "1";
  process.env.MA_REDACTION_VAULT_MAX_ENTRIES = "1";

  try {
    const gateway = await import(
      `${pathToFileURL(path.join(repoRoot, "src", "runtime", "redaction-gateway.js")).href}?policy=${Date.now()}`
    );
    await gateway.redactProviderBoundText("API_TOKEN=first-secret", { kind: "policy-test" });
    await gateway.redactProviderBoundText("API_TOKEN=second-secret", { kind: "policy-test" });
    const vault = JSON.parse(
      await fs.readFile(path.join(tempRoot, ".ma", "state", "redaction-vault.json"), "utf8"),
    );
    assert.equal(Object.keys(vault.entries).length, 1);
    assert.equal(vault.policy.retention_days, 1);
    assert.equal(vault.policy.max_entries, 1);
    const inspection = await gateway.inspectRedactionVault();
    assert.equal(inspection.status, "ok");
    if (process.platform !== "win32") {
      assert.equal((await fs.stat(path.dirname(inspection.path))).mode & 0o777, 0o700);
      assert.equal((await fs.stat(inspection.path)).mode & 0o777, 0o600);
      await fs.chmod(inspection.path, 0o644);
      assert.equal((await gateway.inspectRedactionVault()).status, "warning");
      await gateway.saveRedactionVault(vault);
    }
    assert.equal((await gateway.purgeRedactionVault({ dryRun: true })).status, "would-purge");
    assert.equal((await fs.stat(inspection.path)).isFile(), true);
    assert.equal((await gateway.purgeRedactionVault()).status, "purged");
    await assert.rejects(() => fs.stat(inspection.path), { code: "ENOENT" });
  } finally {
    if (previousRoot === undefined) delete process.env.MA_ROOT;
    else process.env.MA_ROOT = previousRoot;
    if (previousRetention === undefined) delete process.env.MA_REDACTION_VAULT_RETENTION_DAYS;
    else process.env.MA_REDACTION_VAULT_RETENTION_DAYS = previousRetention;
    if (previousMax === undefined) delete process.env.MA_REDACTION_VAULT_MAX_ENTRIES;
    else process.env.MA_REDACTION_VAULT_MAX_ENTRIES = previousMax;
  }
});
