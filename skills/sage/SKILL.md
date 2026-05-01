---
name: sage
description: "Use when the user wants evidence-backed technology choices, OSS evaluation, and source-grounded validation of the stack proposed in `$arch`."
---

# Sage

Use this skill inside Codex to verify or challenge stack choices with real sources.

## Output

Produce:
- candidate tools, libraries, or services
- why each option fits or fails the architecture
- source-backed evidence from official docs, upstream repos, or approved GitMCP sources
- recommendation with tradeoffs
- unresolved gaps or missing evidence
- exact next trigger, usually `$flow`

## Rules

- Do not invent package capabilities or maturity claims.
- Prefer primary sources over summaries when validating technical details.
- If the evidence is weak or contradictory, say so clearly and keep the recommendation conditional.
