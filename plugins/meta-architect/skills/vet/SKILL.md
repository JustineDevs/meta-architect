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

## Procedure

1. Enumerate assets, actors, trust boundaries, permissions, and external dependencies.
2. Trace sensitive inputs from entry to storage, logs, tools, and outbound responses.
3. Test abuse cases such as confused deputy behavior, injection, replay, overbroad access, and failure disclosure.
4. Propose least-privilege mitigations with owner, verification, and residual risk.
5. Route approved remediation to `$vibe` and keep security gate ownership explicit.

## Default evidence dossier

Use [`docs/reference/security-verification.md`](../../docs/reference/security-verification.md)
as the default OWASP ASVS cross-check for web, API, plugin, and hosted MCP
surfaces. Map each material finding to a control and verification artifact.
Use the SLSA source for build and release supply-chain findings. Neither source
replaces the product threat model, and no standard claim is valid without
version-pinned evidence.

## Quality bar

- Findings are tied to a concrete attack path and impact.
- “Read-only” claims are verified against actual tools, routes, and deployment behavior.
- Accepted risks include rationale, scope, and a future review trigger.

## Example

For a hosted plugin, verify domain ownership, endpoint authentication, tool annotations, skill provenance, secret handling, and whether any route can cause an unapproved side effect.
