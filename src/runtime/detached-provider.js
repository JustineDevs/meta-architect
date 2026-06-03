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
    const probe = spawnSync("tmux", ["ls"], { encoding: "utf8" });
    if (!probe.error) {
      return "tmux";
    }
  }

  return "none";
}

export async function launchDetachedTrack({ trackId, title, command, args = [] }) {
  const provider = resolveDetachedProvider();
  await ensureDir(getRuntimeLogsRoot());
  const logPath = path.join(getRuntimeLogsRoot(), `${trackId}.log`);

  if (provider !== "tmux") {
    await fs.writeFile(
      logPath,
      `provider=none\ntitle=${title}\ncommand=${[command, ...args].join(" ")}\n`,
      "utf8",
    );
    return {
      provider: "none",
      executionPane: null,
      pid: null,
      logPath,
      started: false,
    };
  }

  const sessionName = `ma_${trackId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const shellCommand = `${[command, ...args].join(" ")} > ${logPath} 2>&1`;
  const started = spawnSync(
    "tmux",
    ["new-session", "-d", "-s", sessionName, "/bin/sh", "-lc", shellCommand],
    { encoding: "utf8" },
  );

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

  return {
    provider: "tmux",
    executionPane: sessionName,
    pid: null,
    logPath,
    started: true,
  };
}
