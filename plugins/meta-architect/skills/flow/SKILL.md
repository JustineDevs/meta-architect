---
name: flow
description: "Use when the user wants logic validation: states, transitions, invariants, edge cases, dead ends, and blockers before implementation."
---

# Flow

Use this skill inside Codex to pressure-test how the system behaves, not just how it is structured.

## Output

Produce:
- `decision`, `status`, `evidence`, `blockers`, `next_allowed_triggers`
- key actors and system states
- state map and failure flows
- main flows and failure flows
- invariants and state transitions
- race conditions, dead ends, and consistency risks
- missing requirements or ambiguous behavior
- exact next trigger, usually `$vet`

## Rules

- Focus on behavior, not UI polish or low-level code details.
- Surface ambiguity aggressively when it affects correctness.
- Prefer simple state models over sprawling branching logic.

## Procedure

1. List actors, inputs, persistent state, external boundaries, and terminal outcomes.
2. Draw the happy path and at least one failure, retry, cancellation, and partial-completion path.
3. State invariants that must remain true across transitions and retries.
4. Identify races, stale reads, duplicate actions, and irreversible edges.
5. Return the smallest state-model correction and route implementation to `$vet`.

## Default evidence dossier

Use [`docs/reference/reliability-and-recovery.md`](../../docs/reference/reliability-and-recovery.md)
when the task includes retries, recovery, partial completion, concurrency, or
operational failure. Apply its review fields to the concrete state model and
cite the pinned source in the receipt. The dossier is guidance, not proof that
the implementation is reliable; tests and runtime evidence remain required.

## Quality bar

- Every transition has a precondition, action, resulting state, and failure outcome.
- Retries are idempotent or explicitly bounded.
- The model distinguishes user intent, system observation, and external side effects.

## Example

For a deployment flow, model draft, build, verification, publish, failure, and rollback states instead of treating a successful CLI request as proof that production is ready.
