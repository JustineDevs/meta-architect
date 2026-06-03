---
name: vibe
description: "Use when the user wants a DX and UX review of the planned workflow before implementation proceeds."
---

# Vibe

Use this skill inside Codex to review whether the system will feel coherent for both operators and end users.

## Output

Produce:
- `decision`, `status`, `evidence`, `blockers`, `next_allowed_triggers`
- developer workflow risks
- user workflow risks
- operator friction and user friction
- complexity hotspots
- onboarding or operability friction
- simplifications that improve clarity
- exact next trigger, usually `$build`

## Rules

- Focus on concrete friction, not aesthetics-only feedback.
- Prefer fewer surfaces, fewer steps, and clearer operator outcomes.
- Preserve the architecture and security constraints established earlier in the flow.
