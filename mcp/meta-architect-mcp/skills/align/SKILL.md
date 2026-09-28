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

## Procedure

1. Identify the exact artifact, decision, lane, and owner currently in scope.
2. Separate facts already verified from assumptions, requests, and unresolved choices.
3. Normalize conflicting terms into one product-native vocabulary and record exclusions.
4. Rewrite the smallest useful prompt, acceptance check, or handoff note.
5. Return the next owner and trigger; do not silently advance a gated lane.

## Quality bar

- Every recommendation names its evidence or labels the gap as unknown.
- Scope changes are explicit and reversible.
- The result is actionable by one next owner, not a broad list of suggestions.

## Example

For “the release flow is drifting,” distinguish the package version, Git tag, release workflow, and published artifact before proposing a correction. Route implementation to the owning lane after the terminology and boundary are stable.
