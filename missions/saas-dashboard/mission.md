# Mission: SaaS Dashboard

## Scenario

A team wants a SaaS dashboard with clear operator workflows, evidence-backed stack selection, and gated build readiness.

## Goal

Use Meta-Architect to move a SaaS dashboard idea into a disciplined build-ready state.

## Constraints

- architecture must be explicit
- evidence should be tied to approved sources
- DX/UX should be reviewed before build unlock

## Expected gate movement

- `idea_status: DRAFT -> CLEAR`
- `architecture_status: DRAFT -> APPROVED`
- `evidence_status: MISSING -> VERIFIED | PARTIAL`
- `logic_status: PENDING -> GREEN`
- `security_status: PENDING -> GREEN`
- `experience_status: PENDING -> GREEN | WAIVED`
- `build_status: LOCKED -> READY`

## Expected generated artifacts

- `.ma/decisions.json`
- `.ma/release.json`
- `.ma/evidence/sources.json`
- `.ma/evidence/outcomes.json`

## Pass criteria

- `$arch` defines the system blueprint
- `$sage` returns approved OSS sources
- `$flow` records a baseline state review
- `$vibe` records baseline operator/user experience guidance
- `$build` unlocks only after the required gates are ready
