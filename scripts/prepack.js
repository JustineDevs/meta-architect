#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import process from "node:process";

execFileSync(process.execPath, ["./scripts/plugin-sync.js"], {
  stdio: "inherit",
  env: { ...process.env, MA_PLUGIN_SYNC_MODE: "copy" },
});
