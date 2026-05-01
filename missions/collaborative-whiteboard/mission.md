# Mission: Collaborative Whiteboard

## Scenario

A team wants to design a real-time collaborative whiteboard for remote product collaboration. They need architecture, evidence-backed stack selection, state validation, security review, DX/UX review, and a gated build plan before implementation begins.

## Goal

Use Meta-Architect to take the whiteboard project from idea capture through build-readiness without bypassing any required gates.

## Architecture constraints

The mission should assume:
- real-time collaboration matters
- shared board state matters
- concurrent cursor/session behavior matters
- user/session security matters
- build should remain blocked until evidence, logic, and security are green

## Evidence expectations

`$sage` should bind major choices to approved GitMCP-backed OSS sources using the configured runtime evidence path.

At minimum, the mission should produce evidence tied to:
- architecture-level stack choices
- collaboration-related library/framework choices
- security-sensitive dependencies when relevant

## Expected gate movement

Expected happy-path gate progression:
- `idea_status: DRAFT -> CLEAR`
- `architecture_status: DRAFT -> APPROVED`
- `evidence_status: MISSING -> VERIFIED`
- `logic_status: PENDING -> GREEN`
- `security_status: PENDING -> GREEN`
- `experience_status: PENDING -> GREEN`
- `build_status: LOCKED -> READY`

If a required gate does not turn green, `$build` must remain locked.

## Expected generated artifacts

The mission should cause updates to:
- `.meta-architect/decisions.json`
- `.meta-architect/release.json`
- `.meta-architect/evidence/sources.json`
- `.meta-architect/evidence/audits.json` when relevant
- `.meta-architect/evidence/outcomes.json` when relevant

## Pass criteria

Pass if:
- `$arch` proposes a coherent first-pass architecture
- `$sage` records evidence-backed sources
- `$flow` records the kernel’s baseline state review for the mission
- `$vet` produces a baseline security review
- `$vibe` produces baseline DX/UX guidance
- `$build` remains blocked until all required statuses are satisfied, then unlocks with a bounded branch/worktree plan

## Fail criteria

Fail if:
- major stack recommendations lack evidence
- state transitions are not recorded
- security review is skipped
- `$build` unlocks before required gates are green
- required `.meta-architect` product artifacts are not updated

## Evaluation notes

This mission proves that Meta-Architect behaves like a disciplined architecture-and-gating system, not like a generic chat wrapper.

Related surfaces:
- [sandbox.md](./sandbox.md)
- [docs/getting-started.md](../../docs/getting-started.md)
- [docs/skills.md](../../docs/skills.md)
- [prompts/architect.md](../../prompts/architect.md)
- [skills/meta-architect/SKILL.md](../../skills/meta-architect/SKILL.md)
