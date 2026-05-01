# Skills

Meta-Architect’s canonical runtime surface is:
- `$arch`
- `$sage`
- `$flow`
- `$vet`
- `$vibe`
- `$build`

## Real usage path

The intended operator flow is documented in [example/usage-workflow.md](../example/usage-workflow.md).

Use it like this:
1. Launch `ma --madmax --high`
2. Start with the structured `$arch` prompt
3. Continue through `$sage -> $flow -> $vet -> $vibe -> $build`

## Shared output contract

Every skill result must include:
- `decision`
- `status`
- `evidence`
- `blockers`
- `next_allowed_triggers`

## Status ownership

- `ma idea` -> `idea_status`
- `$arch` -> `architecture_status`
- `$sage` -> `evidence_status`
- `$flow` -> `logic_status`
- `$vet` -> `security_status`
- `$vibe` -> `experience_status`
- `$build` -> `build_status`

## Operator note

The runtime trigger surface is primary. The `ma setup`, `ma idea`, `ma run ...`, and `ma status` commands are helper paths for repository setup and scripted execution, not the main user journey.
