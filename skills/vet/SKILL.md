---
name: vet
description: "Use when the user wants a security and trust-boundary review of the current design before implementation or release."
---

# Vet

Use this skill inside Codex to review security posture before the build lane. `$vet` remains the sole security gate even as Meta-Architect ships deeper native security playbooks.

## Output

Produce:
- `decision`, `status`, `evidence`, `blockers`, `next_allowed_triggers`
- trust boundaries
- authn/authz expectations
- sensitive data paths
- abuse cases and likely failure modes
- concrete mitigations
- accepted risks
- release blockers vs acceptable risks
- exact next trigger, usually `$vibe`

## Rules

- Prioritize material risks over exhaustive but low-value checklists.
- Use `references/security-playbooks.md` when you need the native security playbook set for common trust-boundary reviews.
- Keep security guidance product-owned and lane-aware. Do not introduce a second umbrella or a separate security release gate.
- Call out missing assumptions that affect security posture.
- Distinguish between must-fix blockers and documented accepted risk.
