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

## Procedure

1. Walk the complete user journey from discovery through setup, first success, failure, and recovery.
2. Identify ambiguity, waiting, duplicated input, hidden state, and unsafe defaults.
3. Check terminology, feedback, loading states, keyboard access, responsive behavior, and documentation continuity.
4. Recommend the fewest changes that materially improve completion and confidence.
5. Hand a prioritized, testable implementation slice to `$build`.

## Default evidence dossier

Use [`docs/reference/accessibility-and-usability.md`](../../docs/reference/accessibility-and-usability.md)
for user-facing web, documentation, plugin, and CLI-adjacent surfaces. Map
material barriers to WCAG 2.2 criteria and name the automated, keyboard,
assistive-technology, and human checks that verify the result. WCAG is an
accessibility baseline, not a complete usability verdict.

## Quality bar

- Every friction point explains who is affected and where it occurs.
- Visual polish never hides missing behavior, validation, or recovery.
- Recommendations preserve accessibility and the safety boundaries from `$vet`.

## Example

For a plugin setup flow, verify that users can understand the MCP URL, scan state, skill import status, policy requirements, and next action without relying on stale or ambiguous status text.
