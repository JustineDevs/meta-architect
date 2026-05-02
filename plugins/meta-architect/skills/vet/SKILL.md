---
name: vet
description: "Use when the user wants a security and trust-boundary review of the current design before implementation or release."
---

# Vet

Use this skill inside Codex to review security posture before the build lane.

## Output

Produce:
- trust boundaries
- authn/authz expectations
- sensitive data paths
- abuse cases and likely failure modes
- concrete mitigations
- release blockers vs acceptable risks
- exact next trigger, usually `$vibe`

## Rules

- Prioritize material risks over exhaustive but low-value checklists.
- Call out missing assumptions that affect security posture.
- Distinguish between must-fix blockers and documented accepted risk.
