# Skill Contract

## Active Autonomy Core

Use `AUTO-CONTINUE` for clear, safe, reversible, already-requested workspace work. `ASK` only for destructive, irreversible, credential-gated, external-production, materially scope-changing actions, or missing authority. Do not use permission-handoff phrasing on AUTO-CONTINUE branches. Terminal workflow replies must name `finished`, `blocked`, `failed`, `cancelled`, or `askuserQuestion` with evidence or blocker.

Every Meta-Architect skill result must include:
- `decision`
- `status`
- `evidence`
- `blockers`
- `next_allowed_triggers`

## Contract discipline

- Skills must not hide blocked prerequisites.
- Skills must not silently upgrade statuses.
- Skills must not claim evidence they do not actually have.
- Skills may perform a structured baseline review without pretending to be a deep autonomous specialist if the current kernel does not support that depth yet.

## Required responsibilities

- `$arch`
  - structured first-pass blueprint
  - stack rationale
  - tradeoffs
  - downstream evidence requirements
- `$sage`
  - approved OSS candidates
  - source mappings
  - verified vs partial vs missing distinction
- `$flow`
  - baseline state review
  - blocker reporting
  - gate decision
- `$vet`
  - baseline security review
  - risk findings
  - gate decision
- `$vibe`
  - baseline DX/UX review
  - waiver-capable experience gate output
- `$build`
  - bounded branch/worktree plan
  - only after gates pass
