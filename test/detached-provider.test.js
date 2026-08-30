import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { createTestNamespace } from "../src/test-fixtures.js";

test("launchDetachedTrack writes a tmux log file when tmux is available", async () => {
  const tempRoot = createTestNamespace("meta-architect-detached");
  const binDir = path.join(tempRoot, "bin");
  await fs.mkdir(binDir, { recursive: true });
  await fs.writeFile(
    path.join(binDir, "tmux"),
    '#!/bin/sh\nif [ "$1" = "new-session" ]; then\n  printf "%s\\n" "$@" > "$MA_ROOT/tmux-args"\nfi\ncase "$1" in\n  ls|new-session|pipe-pane) exit 0 ;;\n  *) exit 0 ;;\nesac\n',
    "utf8",
  );
  await fs.chmod(path.join(binDir, "tmux"), 0o755);
  const previousRoot = process.env.MA_ROOT;
  const previousTmuxProvider = process.env.MA_TMUX_PROVIDER;
  const previousPath = process.env.PATH;
  process.env.MA_ROOT = tempRoot;
  process.env.MA_TMUX_PROVIDER = "1";
  process.env.PATH = `${binDir}${path.delimiter}${previousPath ?? ""}`;

  try {
    const module = await import(
      `${pathToFileURL(path.join(process.cwd(), "src", "runtime", "detached-provider.js")).href}?t=${Date.now()}`
    );

    const result = await module.launchDetachedTrack({
      trackId: "log-smoke",
      title: "log smoke",
      command: process.execPath,
      args: ["-e", "console.log('detached log; $HOME')", "arg with spaces", "quote'and\"redirect>"],
    });

    assert.equal(result.started, true);
    assert.equal(result.provider, "tmux");
    assert.equal(typeof result.logPath, "string");

    const log = await fs.readFile(result.logPath, "utf8");
    assert.match(log, /provider=tmux/);
    assert.match(log, /title_present=true/);
    assert.match(log, /command=/);
    assert.doesNotMatch(log, /log smoke/);
    const tmuxArgs = await fs.readFile(path.join(tempRoot, "tmux-args"), "utf8");
    assert.match(tmuxArgs, /'-e'/);
    assert.match(tmuxArgs, /'console\.log\('\\''detached log; \$HOME'\\''\)'/);
    assert.match(tmuxArgs, /'arg with spaces'/);
    assert.match(tmuxArgs, /'quote'\\''and"redirect>'/);
    assert.doesNotMatch(tmuxArgs, /\/bin\/sh|-c/);
  } finally {
    if (previousRoot === undefined) {
      delete process.env.MA_ROOT;
    } else {
      process.env.MA_ROOT = previousRoot;
    }
    if (previousTmuxProvider === undefined) {
      delete process.env.MA_TMUX_PROVIDER;
    } else {
      process.env.MA_TMUX_PROVIDER = previousTmuxProvider;
    }
    if (previousPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = previousPath;
    }
  }
});

test("launchDetachedTrack confines log paths and metadata", async () => {
  const tempRoot = createTestNamespace("meta-architect-detached-safe");
  const previousRoot = process.env.MA_ROOT;
  const previousProvider = process.env.MA_DETACHED_PROVIDER;
  process.env.MA_ROOT = tempRoot;
  process.env.MA_DETACHED_PROVIDER = "none";

  try {
    const module = await import(
      `${pathToFileURL(path.join(process.cwd(), "src", "runtime", "detached-provider.js")).href}?safe=${Date.now()}`
    );
    const result = await module.launchDetachedTrack({
      trackId: "../escape;secret",
      title: "sk-super-secret-title",
      command: "/usr/bin/node",
    });

    assert.equal(path.dirname(result.logPath), path.join(tempRoot, ".ma", "logs"));
    const log = await fs.readFile(result.logPath, "utf8");
    assert.doesNotMatch(log, /sk-super-secret-title|escape;secret|\/usr\/bin\/node/);
    assert.match(log, /command=node/);
  } finally {
    if (previousRoot === undefined) delete process.env.MA_ROOT;
    else process.env.MA_ROOT = previousRoot;
    if (previousProvider === undefined) delete process.env.MA_DETACHED_PROVIDER;
    else process.env.MA_DETACHED_PROVIDER = previousProvider;
  }
});
