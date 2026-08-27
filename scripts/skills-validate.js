#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parseSkillFrontmatter, validateSkillFrontmatter } from "../src/skill-frontmatter.js";

const repoRoot = process.cwd();
const skillsRoot = path.join(repoRoot, "skills");

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

async function validateSkillDir(skillDir) {
  const skillName = path.basename(skillDir);
  const skillPath = path.join(skillDir, "SKILL.md");
  const agentPath = path.join(skillDir, "agents", "openai.yaml");

  const skillContent = await fs.readFile(skillPath, "utf8").catch(() => null);
  if (!skillContent) {
    throw new Error(`${skillName}: missing SKILL.md`);
  }

  try {
    validateSkillFrontmatter(parseSkillFrontmatter(skillContent), skillName);
  } catch (error) {
    throw new Error(`${skillName}: ${error.message}`);
  }

  const agentContent = await fs.readFile(agentPath, "utf8").catch(() => null);
  if (!agentContent) {
    throw new Error(`${skillName}: missing agents/openai.yaml`);
  }

  const requiredAgentKeys = [
    "interface:",
    "display_name:",
    "short_description:",
    "default_prompt:",
  ];

  for (const key of requiredAgentKeys) {
    if (!agentContent.includes(key)) {
      throw new Error(`${skillName}: agents/openai.yaml missing ${key}`);
    }
  }

  console.log(`${skillName}: valid`);
}

async function main() {
  const entries = await fs.readdir(skillsRoot, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory());

  if (directories.length === 0) {
    throw new Error("No skill directories found in skills/");
  }

  for (const entry of directories) {
    await validateSkillDir(path.join(skillsRoot, entry.name));
  }
}

main().catch((error) => {
  fail(error.message);
});
