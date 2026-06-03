import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const proofPath = "data/clone-data.proof.json";
const ledgerPath = "data/clone-data.ledger.json";
const rvfPath = "data/clone-data.rvf";

test("clone-data artifacts are real package-visible proof files", async () => {
  const [proof, ledger, rvf, pkg] = await Promise.all([
    fs.readFile(proofPath, "utf8").then(JSON.parse),
    fs.readFile(ledgerPath, "utf8").then(JSON.parse),
    fs.readFile(rvfPath, "utf8"),
    fs.readFile("package.json", "utf8").then(JSON.parse),
  ]);

  assert.equal(proof.schemaVersion, "1.0.0");
  assert.equal(proof.record_type, "clone_data_proof");
  assert.equal(proof.records_as, "production_evidence");
  assert.equal(proof.build_evidence, true);
  assert.equal(proof.claims.length >= 3, true);
  assert.equal(proof.verification_commands.includes("npm run release:check"), true);

  assert.equal(ledger.schemaVersion, "1.0.0");
  assert.equal(ledger.record_type, "clone_data_ledger");
  assert.equal(ledger.records_as, "production_evidence");
  assert.equal(
    ledger.entries.some((entry) => entry.path === proofPath),
    true,
  );
  assert.equal(
    ledger.entries.some((entry) => entry.path === ledgerPath),
    true,
  );
  assert.equal(
    ledger.entries.some((entry) => entry.path === rvfPath),
    true,
  );
  assert.equal(ledger.integrity_policy.empty_files_allowed, false);
  assert.equal(ledger.integrity_policy.placeholder_claims_allowed, false);

  assert.match(rvf, /record_type: clone_data_runtime_verification_file/);
  assert.match(rvf, /node --test test\/clone-data-artifacts\.test\.js/);
  assert.equal(pkg.files.includes("data/"), true);
});
