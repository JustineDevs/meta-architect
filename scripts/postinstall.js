#!/usr/bin/env node

import fs from "node:fs/promises";
import process from "node:process";
import { installSkills, installSupportBundle } from "../src/skill-installer.js";

async function main() {
  const dryRun = process.env.MA_POSTINSTALL_DRY_RUN === "1";
  const skipSkills = process.env.MA_SKIP_SKILLS === "1";
  const receiptPath = process.env.MA_POSTINSTALL_RECEIPT;
  console.log(
    `meta-architect: postinstall skills=${skipSkills ? "disabled" : "enabled"} dry-run=${dryRun ? "yes" : "no"}`,
  );
  if (process.env.MA_SKIP_AUTO_INSTALL === "1") {
    console.log("meta-architect: skipped Codex skill auto-install");
    return;
  }

  if (dryRun || skipSkills) {
    console.log(
      `meta-architect: ${dryRun ? "would install" : "skipped"} Codex skills and support assets`,
    );
    return;
  }

  const [
    { targetRoot: skillRoot, installed: skills },
    { targetRoot: bundleRoot, installed: assets },
  ] = await Promise.all([installSkills(), installSupportBundle()]);
  console.log(`meta-architect: installed ${skills.length} Codex skills into ${skillRoot}`);
  console.log(`meta-architect: installed ${assets.length} support assets into ${bundleRoot}`);
  if (receiptPath) {
    await fs.writeFile(
      receiptPath,
      `${JSON.stringify({ schemaVersion: "0.1.0", skills, assets, skillRoot, bundleRoot }, null, 2)}\n`,
    );
    console.log(`meta-architect: receipt ${receiptPath}`);
  }
}

main().catch((error) => {
  console.error(`meta-architect: failed to install Codex skills: ${error.message}`);
  process.exitCode = 1;
});
