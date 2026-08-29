import assert from "node:assert/strict";
import test from "node:test";
import { measureWidth, padCell, renderGrid } from "../src/tui/grid.js";
import { renderReleaseGrid } from "../src/tui/status-grid.js";

test("grid renderer aligns cells and ignores ANSI width", () => {
  assert.equal(measureWidth("\u001b[32mOK\u001b[0m"), 2);
  assert.equal(padCell("x", 3), "x  ");
  const output = renderGrid([
    ["Gate", "Status"],
    ["Build", "DONE"],
  ]);
  assert.match(output, /\| Gate {2}\| Status \|/);
  assert.match(output, /\+[-+]+\+/);
});

test("release grid renders all Maestro gates and next triggers", () => {
  const output = renderReleaseGrid(
    {
      idea_status: "CLEAR",
      architecture_status: "APPROVED",
      evidence_status: "VERIFIED",
      logic_status: "VERIFIED",
      security_status: "VERIFIED",
      experience_status: "VERIFIED",
      build_status: "READY",
    },
    ["$build"],
  );
  for (const gate of [
    "Idea",
    "Architecture",
    "Evidence",
    "Logic",
    "Security",
    "Experience",
    "Build",
    "$build",
  ])
    assert.match(output, new RegExp(gate.replace("$", "\\$")));
});
