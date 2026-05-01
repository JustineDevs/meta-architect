#!/usr/bin/env node

import process from "node:process";
import { installSkills } from "../src/skill-installer.js";

async function main() {
  if (process.env.MA_SKIP_AUTO_INSTALL === "1") {
    console.log("meta-architect: skipped Codex skill auto-install");
    return;
  }

  const { targetRoot, installed } = await installSkills();
  console.log(`meta-architect: installed ${installed.length} Codex skills into ${targetRoot}`);
}

main().catch((error) => {
  console.error(`meta-architect: failed to install Codex skills: ${error.message}`);
  process.exitCode = 1;
});
