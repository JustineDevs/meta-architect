#!/usr/bin/env node

import process from "node:process";
import { installSkills, installSupportBundle } from "../src/skill-installer.js";

async function main() {
  if (process.env.MA_SKIP_AUTO_INSTALL === "1") {
    console.log("meta-architect: skipped Codex skill auto-install");
    return;
  }

  const [
    { targetRoot: skillRoot, installed: skills },
    { targetRoot: bundleRoot, installed: assets },
  ] = await Promise.all([installSkills(), installSupportBundle()]);
  console.log(`meta-architect: installed ${skills.length} Codex skills into ${skillRoot}`);
  console.log(`meta-architect: installed ${assets.length} support assets into ${bundleRoot}`);
}

main().catch((error) => {
  console.error(`meta-architect: failed to install Codex skills: ${error.message}`);
  process.exitCode = 1;
});
