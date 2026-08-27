import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  compressMaState,
  copyProjectFixture,
  createMinimalFixture,
  createTestNamespace,
  getTestDiskUsage,
  pruneTestFixture,
  removeTestNamespace,
  runTestWithStreaming,
  TEST_FIXTURE_ROOT,
} from "../src/test-fixtures.js";

test("test namespaces are isolated, bounded, and unique", async (t) => {
  const first = createTestNamespace("disk test");
  const second = createTestNamespace("disk test");
  t.after(() => Promise.all([removeTestNamespace(first), removeTestNamespace(second)]));
  assert.notEqual(first, second);
  assert.match(first, /ma-tests\/disk-test-[^-]+-[^-]+-[^-]+/);
  assert.equal(path.dirname(first), TEST_FIXTURE_ROOT);
});

test("minimal fixtures write only declared files and prune generated state", async (t) => {
  const root = createTestNamespace("minimal");
  t.after(() => removeTestNamespace(root));
  await createMinimalFixture(root, {
    files: { "package.json": "{}\n", "src/index.ts": "export {}\n" },
    maContext: { languages: ["typescript"] },
  });
  await fs.mkdir(path.join(root, ".ma", "runtime"), { recursive: true });
  await fs.writeFile(path.join(root, ".ma", "runtime", "large.log"), "state\n");
  await pruneTestFixture(root);
  await fs.access(path.join(root, "src/index.ts"));
  await assert.rejects(fs.access(path.join(root, ".ma", "runtime")));
  assert.ok((await getTestDiskUsage(root)) < 20 * 1024 * 1024);
});

test("one hundred minimal fixtures stay within the disk and setup budgets", async () => {
  const roots = [];
  const started = performance.now();
  try {
    for (let index = 0; index < 100; index += 1) {
      const root = createTestNamespace(`budget-${index}`);
      roots.push(root);
      await createMinimalFixture(root, {
        files: {
          "package.json": '{"name":"fixture","version":"1.0.0"}\n',
          "src/index.ts": "export const fixture = true;\n",
        },
        maContext: { languages: ["typescript"] },
      });
    }
    const elapsed = performance.now() - started;
    const usage = await getTestDiskUsage(TEST_FIXTURE_ROOT);
    assert.ok(elapsed < 10_000, `fixture setup exceeded budget: ${elapsed}ms`);
    assert.ok(usage < 1024 * 1024 * 1024, `fixture root exceeded budget: ${usage} bytes`);
    for (const root of roots) {
      assert.ok((await getTestDiskUsage(root)) <= 20 * 1024 * 1024);
    }
  } finally {
    await Promise.all(roots.map((root) => removeTestNamespace(root)));
  }
});

test("pruning removes hook receipts but preserves recent receipts", async (t) => {
  const root = createTestNamespace("receipt-retention");
  t.after(() => removeTestNamespace(root));
  const receipts = path.join(root, ".ma", "hooks", "receipts");
  await fs.mkdir(receipts, { recursive: true });
  const recent = path.join(receipts, "recent.json");
  const stale = path.join(receipts, "stale.json");
  await fs.writeFile(recent, "{}\n");
  await fs.writeFile(stale, "{}\n");
  const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  await fs.utimes(stale, old, old);
  await pruneTestFixture(root);
  await fs.access(recent);
  await assert.rejects(fs.access(stale));
});

test("destructive fixture operations reject paths outside the test namespace", async () => {
  await assert.rejects(
    () => pruneTestFixture(path.join(path.dirname(TEST_FIXTURE_ROOT), "not-a-test-fixture")),
    /must be inside/,
  );
});

test("fixture writes reject symlink escapes", async (t) => {
  const root = createTestNamespace("symlink-root");
  const outside = createTestNamespace("symlink-outside");
  t.after(() => Promise.all([removeTestNamespace(root), removeTestNamespace(outside)]));
  await fs.symlink(outside, path.join(root, "linked"));
  await assert.rejects(
    () => createMinimalFixture(root, { files: { "linked/escape.txt": "nope\n" } }),
    /symlinked fixture path/,
  );
});

test("project copies exclude generated directories", async (t) => {
  const source = createTestNamespace("copy-source");
  const target = createTestNamespace("copy-target");
  t.after(() => Promise.all([removeTestNamespace(source), removeTestNamespace(target)]));
  await fs.mkdir(path.join(source, "node_modules"), { recursive: true });
  await fs.mkdir(path.join(source, ".git"), { recursive: true });
  await fs.writeFile(path.join(source, "README.md"), "small\n");
  await fs.mkdir(path.join(source, "src", "nested"), { recursive: true });
  await fs.writeFile(path.join(source, "src", "nested", "index.ts"), "export {}\n");
  await fs.writeFile(path.join(source, "node_modules", "ignored.js"), "large\n");
  const result = await copyProjectFixture(source, target);
  assert.ok(["reflink", "rsync", "copy"].includes(result.strategy));
  await fs.access(path.join(target, "README.md"));
  await fs.access(path.join(target, "src", "nested", "index.ts"));
  await assert.rejects(fs.access(path.join(target, "node_modules")));

  const fallbackTarget = createTestNamespace("copy-rsync-fallback");
  t.after(() => removeTestNamespace(fallbackTarget));
  const fallback = await copyProjectFixture(source, fallbackTarget, { useReflink: false });
  assert.ok(["rsync", "copy"].includes(fallback.strategy));
  await fs.access(path.join(fallbackTarget, ".active"));
  assert.ok(fallback.bytes <= 50 * 1024 * 1024);
});

test("MA state compresses and removes the source directory", async (t) => {
  const root = createTestNamespace("compress");
  await fs.mkdir(path.join(root, ".ma", "context"), { recursive: true });
  await fs.writeFile(
    path.join(root, ".ma", "context", "index.json"),
    `${"context\n".repeat(100)}\n`,
  );
  const archive = await compressMaState(root);
  assert.ok(archive?.endsWith(".tar.zst") || archive?.endsWith(".tar.gz"));
  assert.equal(path.dirname(archive), path.join(TEST_FIXTURE_ROOT, "retained"));
  t.after(async () => {
    await Promise.all([removeTestNamespace(root), fs.rm(archive, { force: true })]);
  });
  await assert.rejects(fs.access(path.join(root, ".ma")));
  await fs.access(archive);
});

test("streaming output bounds the summary", async (t) => {
  const root = createTestNamespace("streaming");
  t.after(() => removeTestNamespace(root));
  const result = await runTestWithStreaming(
    process.execPath,
    ["-e", "console.log('ok'); console.error('ERROR failed')"],
    {
      logPath: path.join(root, "test.log"),
      summaryPath: path.join(root, "summary.log"),
    },
  );
  assert.equal(result.code, 0);
  assert.match(await fs.readFile(path.join(root, "summary.log"), "utf8"), /ERROR failed/);
});

test("streaming output rejects paths outside the managed namespace", async (t) => {
  const root = createTestNamespace("streaming-paths");
  t.after(() => removeTestNamespace(root));
  assert.throws(
    () =>
      runTestWithStreaming(process.execPath, ["-e", "console.log('no-op')"], {
        logPath: path.join("/tmp", "outside.log"),
        summaryPath: path.join(root, "summary.log"),
      }),
    /Log path must be inside/,
  );
});

test("streaming output enforces the log budget", async (t) => {
  const root = createTestNamespace("streaming-budget");
  t.after(() => removeTestNamespace(root));
  await assert.rejects(
    () =>
      runTestWithStreaming(process.execPath, ["-e", "process.stdout.write('x'.repeat(4096))"], {
        logPath: path.join(root, "test.log"),
        summaryPath: path.join(root, "summary.log"),
        maxLogBytes: 1024,
      }),
    /exceeds disk budget/,
  );
});
