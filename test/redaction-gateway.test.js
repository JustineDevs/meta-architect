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

    const vault = JSON.parse(
      await fs.readFile(path.join(tempRoot, ".ma", "state", "redaction-vault.json"), "utf8"),
    );
    assert.equal(vault.schemaVersion, "0.1.0");
    assert.equal(Object.keys(vault.entries).length >= 3, true);

    const payloadResult = await gateway.redactProviderBoundPayload(
      {
        prompt: "Email developer@meta-architect.io",
        nested: {
          token: "sk-abcdefghijklmnopqrstuvwxyz123456",
        },
      },
      { kind: "structured-unit-test" },
    );
    assert.match(payloadResult.sanitizedPayload.prompt, /__MA_ANONYMOUS_IDENTITY__/);
    assert.match(payloadResult.sanitizedPayload.nested.token, /__MA_SECURE_TOKEN__/);
    assert.equal(payloadResult.redaction_receipt.record_type, "redaction_receipt");
    assert.equal(payloadResult.redaction_receipt.provider_safe, true);

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
