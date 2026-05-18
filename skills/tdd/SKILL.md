---
name: tdd
description: "Use when the user wants regression-first or test-first scaffolding before implementation work expands."
---

# TDD

Use this skill inside Codex when implementation should start by locking behavior with tests. `tdd` is a non-gating helper skill that supports execution once the relevant lane is ready.

## Output

Produce:
- behavior to lock
- minimal regression or failing test shape
- implementation boundary
- proof that the test belongs to the requested change
- exact next trigger, usually the implementation lane or `$cleanup`

## Rules

- Prefer the smallest failing test that proves the requested behavior.
- Lock current behavior before cleanup or refactor work when behavior is not already protected.
- Do not treat `tdd` as a replacement for the build gate.
- Keep test intent explicit so the next implementation step stays narrow.
