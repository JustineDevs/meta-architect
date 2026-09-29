---
name: cleanup
description: "Use when the user wants contract-preserving simplification, anti-slop cleanup, or a final-pass polish after the main decision is made."
---

# Cleanup

Use this skill inside Codex when the core behavior is understood but the artifact still needs simplification, deslop work, or clearer prose. `cleanup` is a non-gating helper skill.

## Output

Produce:
- removable complexity or noisy wording
- behavior-preserving simplifications
- residual risks after cleanup
- exact next trigger, usually the owning lane or release verification

## Rules

- Prefer deletion over addition.
- Preserve behavior and decision ownership while cleaning up.
- Keep user-facing wording concise and product-native.
- Use `references/style-and-deslop.md` for simplification and prose cleanup patterns.

## Procedure

1. Identify the recently changed surface and lock its current behavior with focused checks.
2. Remove duplication, dead paths, vague wording, and unnecessary abstraction one category at a time.
3. Preserve public names, file ownership, safety boundaries, and release semantics.
4. Re-run the targeted checks plus the smallest relevant lint, typecheck, or build command.
5. Report what was removed, what behavior was preserved, and any residual risk.

## Quality bar

- Cleanup reduces concepts or branching rather than adding a second abstraction layer.
- Every deletion is justified by existing behavior or an explicit requirement.
- Formatting-only changes do not obscure functional changes.

## Example

When a docs page has repeated callout markup, reuse the existing component and fix its contract instead of introducing another one-off variant.
