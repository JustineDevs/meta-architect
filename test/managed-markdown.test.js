import assert from "node:assert/strict";
import test from "node:test";
import {
  createManagedMarkdownBlock,
  removeManagedMarkdownBlock,
  replaceManagedMarkdownBlock,
} from "../src/runtime/managed-markdown.js";

test("managed markdown blocks update only one owned region and preserve human text", () => {
  const first = createManagedMarkdownBlock({
    id: "context",
    source: "index.json",
    body: "generated v1",
  });
  const document = `human header\n\n${first}\nhuman footer\n`;
  const next = createManagedMarkdownBlock({
    id: "context",
    source: "index.json",
    body: "generated v2",
  });
  const updated = replaceManagedMarkdownBlock(document, next, "context");
  assert.match(updated, /human header/);
  assert.match(updated, /generated v2/);
  assert.doesNotMatch(updated, /generated v1/);
  assert.match(updated, /human footer/);
  assert.equal(removeManagedMarkdownBlock(updated, "context").includes("generated v2"), false);
});

test("malformed or duplicate managed blocks are preserved and a fresh block is appended", () => {
  const generated = createManagedMarkdownBlock({
    id: "context",
    source: "index.json",
    body: "fresh",
  });
  const malformed = "<!-- MA:MANAGED:START id=context -->\nold\n";
  assert.match(replaceManagedMarkdownBlock(malformed, generated, "context"), /fresh/);
  const duplicate = `${generated}\n${generated}`;
  const recovered = replaceManagedMarkdownBlock(duplicate, generated, "context");
  assert.equal((recovered.match(/MA:MANAGED:START id=context/g) ?? []).length, 3);
});
