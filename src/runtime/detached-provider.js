import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { ensureDir } from "../fs-utils.js";
import { getRuntimeSubsystemPath } from "../paths.js";

export function getRuntimeLogsRoot() {
  return getRuntimeSubsystemPath("logs");
}

export function resolveDetachedProvider() {
  const preferred = process.env.MA_DETACHED_PROVIDER ?? "";
  if (preferred === "tmux" || process.env.MA_TMUX_PROVIDER === "1") {
    const probe = spawnSync("tmux", ["ls"], {
      encoding: "utf8",
      env: buildDetachedEnv(),
    });
    if (!probe.error) {
      return "tmux";
    }
  }

  return "none";
}

export async function launchDetachedTrack({ trackId, title, command, args = [] }) {
  const provider = resolveDetachedProvider();
  await ensureDir(getRuntimeLogsRoot());
  const safeTrackId = sanitizeTrackId(trackId);
  const logPath = path.join(getRuntimeLogsRoot(), `${safeTrackId}.log`);
  const metadata = `title_present=${Boolean(title)}\ncommand=${commandBasename(command)}\narg_count=${args.length}\n`;

  if (provider !== "tmux") {
    await fs.writeFile(logPath, `provider=none\n${metadata}`, "utf8");
    return {
      provider: "none",
      executionPane: null,
      pid: null,
      logPath,
      started: false,
    };
  }

  const sessionName = `ma_${safeTrackId}`;
  await fs.writeFile(logPath, `provider=tmux\n${metadata}`, "utf8");
  const started = spawnSync("tmux", ["new-session", "-d", "-s", sessionName, command, ...args], {
    encoding: "utf8",
    env: buildDetachedEnv(),
  });

  if (started.status !== 0) {
    await fs.writeFile(
      logPath,
      `provider=tmux\nstatus=failed\nstderr=${started.stderr ?? ""}\n`,
      "utf8",
    );
    return {
      provider: "tmux",
      executionPane: sessionName,
      pid: null,
      logPath,
      started: false,
      error: started.stderr?.trim() || "tmux launch failed",
    };
  }

  const piped = spawnSync(
    "tmux",
    ["pipe-pane", "-t", sessionName, "-o", `cat >> ${quoteForShell(logPath)}`],
    { encoding: "utf8", env: buildDetachedEnv() },
  );
  if (piped.status !== 0) {
    spawnSync("tmux", ["kill-session", "-t", sessionName], {
      encoding: "utf8",
      env: buildDetachedEnv(),
    });
    await fs.writeFile(
      logPath,
      `provider=tmux\nstatus=failed\nstderr=${piped.stderr ?? ""}\n`,
      "utf8",
    );
    return {
      provider: "tmux",
      executionPane: sessionName,
      pid: null,
      logPath,
      started: false,
      error: piped.stderr?.trim() || "tmux log pipe failed",
    };
  }

  return {
    provider: "tmux",
    executionPane: sessionName,
    pid: null,
    logPath,
    started: true,
  };
}

const detachedEnvKeys = [
  "PATH",
  "HOME",
  "USERPROFILE",
  "TMPDIR",
  "TMP",
  "TEMP",
  "LANG",
  "LC_ALL",
  "SYSTEMROOT",
  "COMSPEC",
  "MA_ROOT",
];

function buildDetachedEnv() {
  return Object.fromEntries(
    detachedEnvKeys
      .filter((key) => process.env[key] !== undefined)
      .map((key) => [key, process.env[key]]),
  );
}

function sanitizeTrackId(trackId) {
  const safe = String(trackId ?? "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/^_+|_+$/g, "");
  return safe || "track";
}

function commandBasename(command) {
  return (
    String(command ?? "")
      .split(/[\\/]/)
      .pop() || "unknown"
  );
}

function quoteForShell(value) {
  // The provider command never enters a shell; this quote is only for tmux's
  // fixed `cat >> path` pipe command.
  return `'${String(value).replaceAll("'", `'\\''`)}'`;
}
