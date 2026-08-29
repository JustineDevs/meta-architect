#!/usr/bin/env node

import fs from "node:fs/promises";
import process from "node:process";

async function main() {
  const dryRun = process.env.MA_POSTINSTALL_DRY_RUN === "1";
  const skipSkills = process.env.MA_SKIP_SKILLS === "1";
  const receiptPath = process.env.MA_POSTINSTALL_RECEIPT;
  console.log(
    `meta-architect: postinstall skills=${skipSkills ? "disabled" : "enabled"} dry-run=${dryRun ? "yes" : "no"}`,
  );
  if (dryRun || skipSkills || process.env.MA_SKIP_AUTO_INSTALL === "1") {
    console.log("meta-architect: deferred host selection until first interactive launch");
    return;
  }
  console.log("meta-architect: host selection deferred until first interactive launch");
  if (receiptPath) {
    await fs.writeFile(
      receiptPath,
      `${JSON.stringify({ schemaVersion: "0.1.0", deferred: true }, null, 2)}\n`,
    );
    console.log(`meta-architect: receipt ${receiptPath}`);
  }
}

main().catch((error) => {
  console.error(`meta-architect: failed to install Codex skills: ${error.message}`);
  process.exitCode = 1;
});
