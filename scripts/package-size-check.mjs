#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const budget = Number(process.env.MA_PACKAGE_SIZE_BUDGET ?? 5 * 1024 * 1024);
const result = spawnSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
  encoding: "utf8",
});
if (result.status !== 0) throw new Error(result.stderr || "npm pack inspection failed");
const pack = JSON.parse(result.stdout)[0];
const excludedMedia = pack.files.filter((file) => /docs\/assets\//.test(file.path));
if (excludedMedia.length > 0)
  throw new Error(
    `Heavy demo media included: ${excludedMedia.map((file) => file.path).join(", ")}`,
  );
const unexpectedExecutables = pack.files.filter(
  (file) =>
    file.mode === 493 && !file.path.startsWith("bin/") && !/^scripts\/[^/]+\.sh$/.test(file.path),
);
if (unexpectedExecutables.length > 0) {
  throw new Error(
    `Unexpected executable package files: ${unexpectedExecutables.map((file) => file.path).join(", ")}`,
  );
}
console.log(`package size: ${pack.size} bytes (budget ${budget})`);
if (pack.size > budget) throw new Error(`Package exceeds ${budget} byte budget`);
