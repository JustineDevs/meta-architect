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
