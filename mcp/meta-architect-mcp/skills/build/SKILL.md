---
name: build
description: "Use when the user wants to decide whether implementation is ready, what remains blocked, and what the exact next build step should be."
---

# Build

Use this skill inside Codex to convert the earlier review lanes into an implementation-ready decision.

## Output

Produce:
- current readiness verdict
- blockers that still prevent implementation
- the narrowest viable build slice
- branch or worktree suggestions when relevant
- bounded execution state when the build lane is already in progress
- test and verification expectations
- repair path when the bounded slice needs another pass
- the exact next implementation step

## Rules

- Do not claim readiness if architecture, evidence, logic, security, or DX/UX gaps remain unresolved.
- Keep the recommended build slice small, testable, and reversible.
- Treat `$build` as the sole owner of `.ma/plans/build.md` and `build_status`.
- If the user wants code immediately and the path is clear, end with a concrete implementation plan rather than more review prose.

## Procedure

1. Read the current architecture, evidence, security, UX, and logic decisions.
2. Classify each unresolved item as a release blocker, a bounded implementation task, or accepted risk.
3. Select one narrow slice with explicit inputs, changed surfaces, acceptance checks, and rollback boundary.
4. Define the regression-first test shape and the exact verification commands.
5. Hand the bounded slice to execution and keep unrelated cleanup out of scope.

## Default evidence dossier

Use [`docs/reference/supply-chain-readiness.md`](../../docs/reference/supply-chain-readiness.md)
for package, publish, deploy, and artifact work. Identify provenance,
verification, promotion, rollback, and tamper-detection evidence before calling
a release ready. Do not claim an SLSA level without matching evidence.

## Quality bar

- “Ready” means the slice is implementable and testable, not that every future feature is designed.
- No build step may silently publish, deploy, delete, or rewrite user-owned state.
- A blocked result includes the missing evidence and the smallest probe that can unblock it.

## Example

For a plugin release, verify version alignment, package contents, endpoint health, imported skills, release notes, and rollback behavior before recommending publication.
