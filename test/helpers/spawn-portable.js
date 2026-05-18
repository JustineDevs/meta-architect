import { spawnSync } from "node:child_process";

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}

export function spawnPortable(command, args, options = {}) {
  if (process.platform === "win32") {
    return spawnSync(command, args, options);
  }

  const cmd = [command, ...args].map(shellQuote).join(" ");
  return spawnSync("/bin/sh", ["-lc", cmd], {
    ...options,
  });
}
