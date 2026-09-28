---
name: diagnose
description: "Use when the user needs failure triage, blocked-lane diagnosis, or root-cause decomposition before the next gate can move."
---

# Diagnose

Use this skill inside Codex when a lane is blocked, a symptom is vague, or the next useful move is to decompose the failure before editing code. `diagnose` is a non-gating helper skill.

## Output

Produce:
- observed symptom
- likely failure slices
- missing evidence or missing reproduction steps
- smallest next probe
- exact next trigger, usually the owning lane or `$maestro`

## Rules

- Decompose the problem before proposing broad fixes.
- Prefer the smallest reproducible boundary that can confirm or kill a hypothesis.
- Keep release-state ownership with the gated lane that is blocked.
- Escalate assumptions clearly when evidence is still incomplete.

## Procedure

1. Restate the observed symptom, expected behavior, scope, and first failing boundary.
2. Build a short hypothesis tree ordered by likelihood and impact.
3. Run the smallest read-only probe that distinguishes the leading hypotheses.
4. Record exact evidence, including versions, routes, inputs, and failure output.
5. Recommend one repair owner and one verification step; do not make unrelated edits.

## Quality bar

- Separate a symptom from a root cause and a contributing condition.
- Never infer success from a stale UI state, cached artifact, or unverified deployment.
- If evidence is insufficient, state the next probe instead of inventing certainty.

## Example

For a plugin skill marked “Error,” inspect the archive root, manifest, skill path, front matter, and server discovery separately before changing the skill text.
