---
name: align
description: "Use when the user needs scope alignment, shared language, or docs clarity before or between gated lanes."
---

# Align

Use this skill inside Codex when the problem is ambiguity, drift, or mismatched language rather than missing implementation. `align` is a non-gating helper skill.

## Output

Produce:
- current ambiguity or mismatch
- normalized terminology
- scope boundary and exclusions
- acceptance checks or rewritten prompts
- exact next trigger, usually `$maestro` or the lane that owns the next decision

## Rules

- Align language and scope without creating a new release gate.
- Prefer tightening existing artifacts over inventing parallel docs.
- Keep terminology Meta-Architect-native for user-facing surfaces.
- Use `references/shared-language.md` for naming, taxonomy, and docs-clarity patterns.
