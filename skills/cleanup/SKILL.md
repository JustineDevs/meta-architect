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
