#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parseSkillFrontmatter, validateSkillFrontmatter } from "../src/skill-frontmatter.js";

const repoRoot = process.cwd();
const skillsRoot = path.join(repoRoot, "skills");
const manifestPath = path.join(skillsRoot, "index.json");

async function main() {
  const entries = await fs.readdir(skillsRoot, { withFileTypes: true });
  const skills = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const skillPath = path.join(skillsRoot, entry.name, "SKILL.md");
    const content = await fs.readFile(skillPath, "utf8");
    const meta = validateSkillFrontmatter(parseSkillFrontmatter(content), entry.name);
    skills.push({
      name: meta.name,
      path: `skills/${entry.name}`,
      description: meta.description,
    });
  }

  skills.sort((left, right) => left.name.localeCompare(right.name));
  await fs.writeFile(
    manifestPath,
    `${JSON.stringify({ schemaVersion: "0.1.0", skills }, null, 2)}\n`,
  );
  console.log(manifestPath);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
