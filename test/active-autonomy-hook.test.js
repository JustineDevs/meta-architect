import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createTestNamespace, removeTestNamespace } from "../src/test-fixtures.js";

const hookPath = fileURLToPath(new URL("../scripts/active-autonomy-hook.mjs", import.meta.url));

function runHook(root, env, payload = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [hookPath], { cwd: root, env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve({ stdout, stderr }) : reject(new Error(stderr)),
    );
    child.stdin.end(JSON.stringify(payload));
  });
}

test("active autonomy hook reports bounded project scope and ignored artifacts", async (t) => {
  const root = createTestNamespace("hook-scope");
  t.after(() => removeTestNamespace(root));
  const result = await runHook(root, { ...process.env, MA_ROOT: root });
  const output = JSON.parse(result.stdout);
  assert.equal(output.scope, "active-project");
  assert.equal(output.scanRoot, root);
  assert.ok(output.ignoredArtifactClasses.includes("node_modules"));
});

test("active autonomy hook allows explicit broad scan opt-in", async (t) => {
  const root = createTestNamespace("hook-broad");
  t.after(() => removeTestNamespace(root));
  const result = await runHook(root, { ...process.env, MA_ROOT: root, MA_HOOK_BROAD_SCAN: "1" });
  const output = JSON.parse(result.stdout);
  assert.equal(output.scope, "broad-opt-in");
  assert.deepEqual(output.ignoredArtifactClasses, []);
});

test("audit profile is broad, read-only, and does not block passive wording", async (t) => {
  const root = createTestNamespace("hook-audit-profile");
  t.after(() => removeTestNamespace(root));
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [hookPath], {
      cwd: root,
      env: { ...process.env, MA_ROOT: root, MA_HOOK_PROFILE: "audit" },
    });
    let stdout = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(JSON.parse(stdout)) : reject(new Error("hook failed")),
    );
    child.stdin.end(JSON.stringify({ last_assistant_message: "Should I proceed?" }));
  });
  assert.equal(result.profile, "audit");
  assert.equal(result.scope, "broad-opt-in");
  assert.equal(result.readOnly, true);
  assert.equal(result.decision, "approve");
  await assert.rejects(fs.access(path.join(root, ".ma", "hooks", "audit.log")));
});

test("blocking hook emits a classified structured receipt", async (t) => {
  const root = createTestNamespace("hook-receipt");
  t.after(() => removeTestNamespace(root));
  const result = await runHook(root, { ...process.env, MA_ROOT: root });
  const output = JSON.parse(result.stdout);
  assert.equal(output.decision, "approve");

  const blocked = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [hookPath], {
      cwd: root,
      env: { ...process.env, MA_ROOT: root },
    });
    let stdout = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(JSON.parse(stdout)) : reject(new Error("hook failed")),
    );
    child.stdin.end(
      JSON.stringify({
        last_assistant_message: "Should I proceed?",
        files: [{ path: "src/index.ts", line: 4 }],
      }),
    );
  });
  assert.equal(blocked.decision, "block");
  const receipt = JSON.parse(await fs.readFile(path.join(root, blocked.receiptPath), "utf8"));
  assert.equal(receipt.classification, "source");
  assert.equal(receipt.matchedFiles[0].line, 4);
});

test("audit previews redact secrets, identities, and local paths without raw values", async (t) => {
  const root = createTestNamespace("hook-preview-redaction");
  t.after(() => removeTestNamespace(root));
  const assistant =
    "Deploy with sk-1234567890123456 for alice@example.com from /home/alice/project/app.ts";
  const user =
    "API_TOKEN=ghp_123456789012345678 and -----BEGIN PRIVATE KEY-----secret-----END PRIVATE KEY-----";
  await runHook(
    root,
    {
      ...process.env,
      MA_ROOT: root,
    },
    { last_assistant_message: assistant, last_user_message: user },
  );

  const audit = JSON.parse(
    (await fs.readFile(path.join(root, ".ma", "hooks", "audit.log"), "utf8")).trim(),
  );
  const persisted = JSON.stringify(audit);
  assert.doesNotMatch(persisted, /sk-1234567890123456|alice@example\.com|ghp_123456789012345678/);
  assert.doesNotMatch(persisted, /BEGIN PRIVATE KEY|\/home\/alice\/project/);
  assert.match(audit.assistantPreview, /__MA_SECURE_TOKEN__/);
  assert.match(audit.userPreview, /__MA_SECURE_ASSIGNMENT__/);
  assert.ok(audit.previewRedactions.assistant.length > 0);
  assert.ok(audit.previewRedactions.user.length > 0);
  assert.equal(Object.hasOwn(audit, "rawValue"), false);
});

test("context hydration hook loads bounded artifacts and skips broad sources", async (t) => {
  const root = createTestNamespace("context-hydration");
  t.after(() => removeTestNamespace(root));
  await fs.mkdir(path.join(root, ".ma", "context"), { recursive: true });
  await fs.writeFile(
    path.join(root, ".ma", "context", "project-index.json"),
    JSON.stringify({ freshness: { status: "fresh" } }),
  );
  await fs.writeFile(path.join(root, ".ma", "context", "agent-brief.md"), "# Brief");
  const hydrationPath = fileURLToPath(
    new URL("../scripts/context-hydration-hook.mjs", import.meta.url),
  );
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [hydrationPath], {
      cwd: root,
      env: { ...process.env, MA_ROOT: root },
    });
    let stdout = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(JSON.parse(stdout)) : reject(new Error("hook failed")),
    );
    child.stdin.end();
  });
  assert.equal(result.loaded.projectIndex, true);
  assert.equal(result.loaded.agentBrief, true);
  assert.ok(result.skipped.includes("full Obsidian vault"));
  assert.equal(result.authority, "generated_context");
});
