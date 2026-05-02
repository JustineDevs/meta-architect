# Skills

Meta-Architect’s canonical Codex runtime surface is:
- `$arch`
- `$sage`
- `$flow`
- `$vet`
- `$vibe`
- `$build`

## Real usage path

Install the package once, start Codex context if needed, and use the skills directly in-session.

```bash
# Install
npm i -g @openai/codex@latest @jstn-sdk/ma@latest

# Start Codex context if needed
ma --madmax --high

# Remove Meta-Architect only
npm uninstall -g @jstn-sdk/ma

# Remove Meta-Architect and Codex
npm uninstall -g @jstn-sdk/ma @openai/codex
```

Then inside the Codex session:
1. Start with the structured `$arch` prompt
2. Continue through `$sage -> $flow -> $vet -> $vibe -> $build`

## Simple difference

Meta-Architect has two surfaces:

- terminal commands
- in-session skills

Terminal commands are run in the shell:

```bash
ma setup
ma init
ma idea "Build a product"
ma status
ma run '$arch'
```

In-session skills are used inside the Codex conversation:

```text
$arch
$sage
$flow
$vet
$vibe
$build
```

Short rule:
- `ma ...` means "run a helper command in the terminal"
- `$...` means "run a Meta-Architect skill inside the Codex session"

Important:
- `ma setup` and `ma init` currently do the same thing
- they only create local support files
- they do not replace the in-session skill flow

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

The in-session skill surface is primary. The `ma` helper commands only exist to start Codex context and to provide repo-local state automation when scripted verification is needed.
