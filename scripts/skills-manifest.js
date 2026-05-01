#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const skillsRoot = path.join(repoRoot, "skills");
const manifestPath = path.join(skillsRoot, "index.json");

function parseFrontmatterNameAndDescription(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    throw new Error("Missing SKILL.md frontmatter");
  }

  const lines = match[1].split("\n");
  let name = "";
  let description = "";
  for (const line of lines) {
    if (line.startsWith("name:")) {
      name = line.slice("name:".length).trim();
    }
    if (line.startsWith("description:")) {
      description = line.slice("description:".length).trim().replace(/^"|"$/g, "");
    }
  }
  return { name, description };
}

async function main() {
  const entries = await fs.readdir(skillsRoot, { withFileTypes: true });
  const skills = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const skillPath = path.join(skillsRoot, entry.name, "SKILL.md");
    const content = await fs.readFile(skillPath, "utf8");
    const meta = parseFrontmatterNameAndDescription(content);
    skills.push({
      name: meta.name,
      path: `skills/${entry.name}`,
      description: meta.description,
    });
  }

  skills.sort((left, right) => left.name.localeCompare(right.name));
  await fs.writeFile(
    manifestPath,
    `${JSON.stringify({ schemaVersion: "1.0.0", skills }, null, 2)}\n`,
  );
  console.log(manifestPath);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
