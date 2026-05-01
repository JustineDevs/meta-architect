# Skills

Meta-Architect’s canonical Codex runtime surface is:
- `$arch`
- `$sage`
- `$flow`
- `$vet`
- `$vibe`
- `$build`

## Real usage path

Install the package once, launch through `ma`, and use the skills directly in-session.

```bash
npm i -g @openai/codex@latest @jstn-sdk/meta-architect@latest
ma --madmax --high
```

Then inside the Codex session:
1. Start with the structured `$arch` prompt
2. Continue through `$sage -> $flow -> $vet -> $vibe -> $build`

## Shared output contract

Every skill result must include:
- `decision`
- `status`
- `evidence`
- `blockers`
- `next_allowed_triggers`

## Status ownership

- project brief -> architecture input
- `$arch` -> `architecture_status`
- `$sage` -> `evidence_status`
- `$flow` -> `logic_status`
- `$vet` -> `security_status`
- `$vibe` -> `experience_status`
- `$build` -> `build_status`

## Operator note

The runtime trigger surface is primary. The `ma` helper commands exist to launch Codex with Meta-Architect attached and to provide repo-local state automation when scripted verification is needed.
