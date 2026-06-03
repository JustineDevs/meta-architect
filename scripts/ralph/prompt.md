# Meta-Architect Ralph Execution Core

You are executing a Meta-Architect story contract, not an independent release authority.

## Required Inputs

1. Read `.ma/plans/prd.json`.
2. Read `.ma/plans/progress.txt`.
3. Pick the highest-priority story where `passes` is `false`.
4. Execute exactly one bounded story per iteration.

## MA Quality Gates

Before marking a story passed, verify:

- `$arch` architecture constraints remain satisfied.
- `$sage` evidence and source claims remain valid.
- `$flow` logic/state invariants remain valid.
- `$vet` security blockers are absent or explicitly owned.
- `$vibe` DX/UX constraints remain acceptable.
- `$build` real-workspace checks pass for the changed slice.

## Authority Boundaries

- Do not mutate `.ma/release.json` or `.ma/decisions.json` directly.
- Return authoritative status through `$maestro`, `$build`, or the owning lane.
- Treat Obsidian/vault context as `vault_context`, never `build_evidence`.
- Treat virtual workspace output as context only, never production proof.
- Treat code-graph rehearsal as a read-only trajectory preview.

## Completion Contract

Update story `passes` only after fresh verification evidence exists.
Append progress to `.ma/plans/progress.txt`.
Record reusable learnings in scoped guidance without overwriting the base workspace contract.
