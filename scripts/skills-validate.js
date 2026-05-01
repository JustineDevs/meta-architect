#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const skillsRoot = path.join(repoRoot, "skills");

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    return null;
  }

  const yaml = match[1];
  const result = {};

  for (const rawLine of yaml.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

async function validateSkillDir(skillDir) {
  const skillName = path.basename(skillDir);
  const skillPath = path.join(skillDir, "SKILL.md");
  const agentPath = path.join(skillDir, "agents", "openai.yaml");

  const skillContent = await fs.readFile(skillPath, "utf8").catch(() => null);
  if (!skillContent) {
    throw new Error(`${skillName}: missing SKILL.md`);
  }

  const frontmatter = extractFrontmatter(skillContent);
  if (!frontmatter) {
    throw new Error(`${skillName}: SKILL.md missing frontmatter`);
  }

  if (!frontmatter.name) {
    throw new Error(`${skillName}: frontmatter missing name`);
  }

  if (frontmatter.name !== skillName) {
    throw new Error(`${skillName}: frontmatter name must match directory name`);
  }

  if (!/^[a-z0-9-]+$/.test(frontmatter.name)) {
    throw new Error(`${skillName}: frontmatter name must be lowercase kebab-case`);
  }

  if (!frontmatter.description || frontmatter.description.length < 10) {
    throw new Error(`${skillName}: frontmatter description is missing or too short`);
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
