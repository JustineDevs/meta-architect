---
name: flow
description: "Use when the user wants logic validation: states, transitions, invariants, edge cases, dead ends, and blockers before implementation."
---

# Flow

Use this skill inside Codex to pressure-test how the system behaves, not just how it is structured.

## Output

Produce:
- key actors and system states
- main flows and failure flows
- invariants and state transitions
- race conditions, dead ends, and consistency risks
- missing requirements or ambiguous behavior
- exact next trigger, usually `$vet`

## Rules

- Focus on behavior, not UI polish or low-level code details.
- Surface ambiguity aggressively when it affects correctness.
- Prefer simple state models over sprawling branching logic.
