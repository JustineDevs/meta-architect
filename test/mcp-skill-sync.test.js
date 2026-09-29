import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("hosted MCP skills mirror the canonical skill sources", async () => {
  const entries = await fs.readdir(path.join(root, "skills"), { withFileTypes: true });
  const skillNames = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

  for (const skillName of skillNames) {
    const canonical = await fs.readFile(path.join(root, "skills", skillName, "SKILL.md"), "utf8");
    const hosted = await fs.readFile(
      path.join(root, "mcp", "meta-architect-mcp", "skills", skillName, "SKILL.md"),
      "utf8",
    );
    assert.equal(hosted, canonical, `${skillName} is stale in the hosted MCP project`);
  }
});

test("hosted MCP includes the architecture glossary used by arch", async () => {
  const canonical = await fs.readFile(
    path.join(root, "data", "system-design-glossary.json"),
    "utf8",
  );
  const hosted = await fs.readFile(
    path.join(root, "mcp", "meta-architect-mcp", "data", "system-design-glossary.json"),
    "utf8",
  );
  assert.equal(hosted, canonical);
});
