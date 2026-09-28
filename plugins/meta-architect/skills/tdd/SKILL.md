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

## Procedure

1. Translate the requested behavior into one observable acceptance example.
2. Choose the narrowest test boundary that fails before the fix and passes after it.
3. Include the important negative or permission case without building a speculative suite.
4. Name fixtures, dependencies, and cleanup requirements explicitly.
5. Hand the locked behavior to the implementation lane and preserve the test as evidence.

## Quality bar

- The test proves user-visible or contract-visible behavior, not implementation trivia.
- Failure output points to the intended boundary.
- Tests do not mutate production systems, secrets, or unrelated user data.

## Example

For a copy button, test clipboard content, keyboard activation, alignment-independent click behavior, and the visible success state rather than only asserting that a handler exists.
