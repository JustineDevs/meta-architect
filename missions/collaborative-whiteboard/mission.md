# Mission: Semantic Release Hardening

## Scenario

Meta-Architect is preparing a production release where every core capability must be real, semantic, package-visible, and proof-gated. The mission covers the current MA workspace itself, not a toy app scenario.

## Goal

Use Meta-Architect to take its own release-hardening work from idea capture through build-readiness without bypassing evidence, logic, security, DX/UX, package, or release gates.

## Architecture constraints

The mission should assume:
- `$maestro` is the canonical umbrella surface
- Obsidian is core vault-context infrastructure, not optional MCP-only tooling
- Ralph is the execution loop for approved work slices
- Caveman/context economy is core output discipline, not a novelty mode
- learning-loop artifacts must make MA more reliable over time
- build should remain blocked until evidence, logic, security, package, and release checks are green

## Evidence expectations

`$sage` should bind major choices to approved GitMCP-backed OSS sources using the configured runtime evidence path.

At minimum, the mission should produce evidence tied to:
- semantic runtime artifacts under `.ma/context/`
- release issue gates under `docs/qa/`
- package exposure and dry-run contents
- Obsidian vault-context graph behavior
- Ralph execution readiness and proof-gated pass/fail state
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
- `.ma/decisions.json`
- `.ma/release.json`
- `.ma/evidence/sources.json`
- `.ma/evidence/audits.json` when relevant
- `.ma/evidence/outcomes.json` when relevant
- `.ma/context/recording-core.json`
- `.ma/context/learning-loop-core.json`
- `.ma/context/workspace-context-pack.json`
- `.ma/context/obsidian-bridge.json`
- `.ma/context/context-economy-core.json`

## Pass criteria

Pass if:
- `$maestro` routes the release-hardening request through the required lanes
- `$arch` proposes a coherent first-pass architecture
- `$sage` records evidence-backed sources
- `$flow` records the kernel’s baseline state review for the mission
- `$vet` produces a baseline security review
- `$vibe` produces baseline DX/UX guidance
- `$build` remains blocked until all required statuses are satisfied, then unlocks with a bounded branch/worktree plan
- package dry-run includes public semantic docs and proof data while excluding runtime caches/state

## Fail criteria

Fail if:
- major stack recommendations lack evidence
- state transitions are not recorded
- security review is skipped
- `$build` unlocks before required gates are green
- required `.ma` product artifacts are not updated
- Obsidian notes are treated as build evidence without gate promotion
- README, DEMO, COVERAGE, or release docs still describe stale toy/demo behavior

## Evaluation notes

This mission proves that Meta-Architect behaves like a disciplined semantic architecture-and-gating system, not like a passive chat wrapper or generic skill bundle.

Related surfaces:
- [sandbox.md](./sandbox.md)
- [docs/getting-started.md](../../docs/getting-started.md)
- [docs/skills.md](../../docs/skills.md)
- [prompts/architect.md](../../prompts/architect.md)
- [skills/meta-architect/SKILL.md](../../skills/meta-architect/SKILL.md)
