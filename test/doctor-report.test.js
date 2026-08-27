import assert from "node:assert/strict";
import test from "node:test";
import { printDoctorStatuses, summarizeDoctorStatuses } from "../src/runtime/doctor-report.js";

test("doctor report uses one status vocabulary for user and package scopes", () => {
  const lines = [];
  const result = printDoctorStatuses(
    "Meta-Architect Package Doctor",
    [{ kind: "OK", label: "package.json", detail: "present" }],
    (line) => lines.push(line),
  );
  assert.equal(result, "READY");
  assert.equal(
    summarizeDoctorStatuses([{ kind: "WARN", label: "context" }]),
    "READY_WITH_WARNINGS",
  );
  assert.deepEqual(lines.slice(0, 2), [
    "Meta-Architect Package Doctor",
    "=============================",
  ]);
  assert.ok(lines.includes("Result: READY"));
});
