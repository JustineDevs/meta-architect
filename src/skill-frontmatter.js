import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const schemaPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "schemas",
  "skill-frontmatter.schema.json",
);
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
export const SKILL_FRONTMATTER_SCHEMA_VERSION = "1.0.0";

function parseScalar(value, lineNumber) {
  if (!value) return "";
  if (value.startsWith('"')) {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed !== "string") throw new Error("must be a string");
      return parsed;
    } catch {
      throw new Error(`frontmatter line ${lineNumber}: invalid double-quoted scalar`);
    }
  }
  if (value.startsWith("'")) {
    if (!value.endsWith("'") || value.length < 2) {
      throw new Error(`frontmatter line ${lineNumber}: invalid single-quoted scalar`);
    }
    return value.slice(1, -1).replace(/''/g, "'");
  }
  if (/[[\]{},]/.test(value)) {
    throw new Error(`frontmatter line ${lineNumber}: only scalar values are supported`);
  }
  return value;
}

export function parseSkillFrontmatter(content) {
  const match = String(content).match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error("SKILL.md missing frontmatter");

  const result = {};
  for (const [index, rawLine] of match[1].split(/\r?\n/).entries()) {
    const lineNumber = index + 2;
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const field = line.match(/^([A-Za-z][A-Za-z0-9_-]*):(?:[ \t]*(.*))$/);
    if (!field) throw new Error(`frontmatter line ${lineNumber}: expected key: value`);
    const [, key, rawValue] = field;
    if (Object.hasOwn(result, key)) throw new Error(`frontmatter: duplicate ${key}`);
    result[key] = parseScalar(rawValue.trim(), lineNumber);
  }
  return result;
}

export function validateSkillFrontmatter(frontmatter, skillName = null) {
  for (const key of Object.keys(frontmatter)) {
    if (!Object.hasOwn(schema.properties, key)) {
      throw new Error(`frontmatter has unknown field ${key}`);
    }
  }
  for (const key of schema.required) {
    if (typeof frontmatter[key] !== "string" || frontmatter[key].length === 0) {
      throw new Error(`frontmatter missing ${key}`);
    }
  }
  if (!new RegExp(schema.properties.name.pattern).test(frontmatter.name)) {
    throw new Error("frontmatter name must be lowercase kebab-case");
  }
  if (frontmatter.description.length < schema.properties.description.minLength) {
    throw new Error("frontmatter description is missing or too short");
  }
  if (skillName && frontmatter.name !== skillName) {
    throw new Error("frontmatter name must match directory name");
  }
  return frontmatter;
}

export const skillFrontmatterSchema = schema;
