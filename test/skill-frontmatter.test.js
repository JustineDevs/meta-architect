import assert from "node:assert/strict";
import test from "node:test";
import {
  parseSkillFrontmatter,
  SKILL_FRONTMATTER_SCHEMA_VERSION,
  skillFrontmatterSchema,
  validateSkillFrontmatter,
} from "../src/skill-frontmatter.js";

test("skill frontmatter exposes a versioned schema and ignores multiline body content", () => {
  assert.equal(SKILL_FRONTMATTER_SCHEMA_VERSION, "1.0.0");
  assert.match(skillFrontmatterSchema.$comment, /1\.0\.0/);
  const value = parseSkillFrontmatter(
    "---\nname: example-skill\ndescription: 'A stable description'\n---\n# Body\nkey: value\n",
  );
  assert.equal(value.name, "example-skill");
});

test("skill frontmatter parses quoted scalars and validates the shared schema", () => {
  const value = parseSkillFrontmatter(
    '---\nname: example-skill\ndescription: "A useful skill: with punctuation."\n---\n',
  );
  assert.deepEqual(validateSkillFrontmatter(value, "example-skill"), {
    name: "example-skill",
    description: "A useful skill: with punctuation.",
  });
});

test("skill frontmatter rejects duplicate, unknown, malformed, and mismatched fields", () => {
  assert.throws(
    () => parseSkillFrontmatter("---\nname: one\nname: two\ndescription: long enough\n---\n"),
    /duplicate name/,
  );
  assert.throws(
    () => validateSkillFrontmatter({ name: "valid", description: "long enough", extra: "no" }),
    /unknown field extra/,
  );
  assert.throws(
    () => parseSkillFrontmatter("---\nname: [invalid]\ndescription: long enough\n---\n"),
    /only scalar values/,
  );
  assert.throws(
    () => validateSkillFrontmatter({ name: "valid", description: "long enough" }, "other"),
    /match directory name/,
  );
});
