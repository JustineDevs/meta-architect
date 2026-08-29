# Skills

Meta-Architect ships three in-session skill layers:

- umbrella autonomous manager: `$maestro`
- fixed gated lanes: `$arch`, `$sage`, `$flow`, `$vet`, `$vibe`, `$build`
- non-gating helper skills: `$align`, `$diagnose`, `$tdd`, `$cleanup`

The package does not ship a separate `$meta-architect` in-session skill. `$maestro` is the umbrella contract for next-step management, bounded lane handoff, and fixed-sequence supervision.

## Real usage path

Install the package once, start Codex context if needed, and use the skills directly in-session.

Recommended CLI install for macOS, Linux, WSL, and Git-Bash:

```bash
# One-line install (POSIX shells only; use WSL/Git-Bash on Windows)
curl -fsSLo install.sh https://cdn.jsdelivr.net/gh/JustineDevs/meta-architect@latest/scripts/install.sh && curl -fsSLo install.sh.sha256 https://cdn.jsdelivr.net/gh/JustineDevs/meta-architect@latest/scripts/install.sh.sha256 && sed 's#scripts/install.sh#install.sh#' install.sh.sha256 | sha256sum -c - && sh install.sh
```

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
1. Start with `$maestro` when you want Meta-Architect to act as the bounded autonomous manager for the workflow
2. Or start with `$arch` when you already know the architecture lane is next
3. Continue through `$sage -> $flow -> $vet -> $vibe -> $build`
4. Use `$align`, `$diagnose`, `$tdd`, or `$cleanup` only as publishable non-gating helper skills around that gated path

## Two surfaces

Meta-Architect has two surfaces:

- terminal commands
- in-session skills

Terminal commands are run in the shell:

```bash
ma setup
ma init
ma idea "Build a product"
ma status
ma status --maestro-view
ma verify --architect
ma run '$arch'
ma run '$maestro' --auto-heal --parallel
```

In-session skills are used inside the Codex conversation:

```text
$maestro
$arch
$sage
$flow
$vet
$vibe
$build
$align
$diagnose
$tdd
$cleanup
```

Short rule:
- `ma ...` means "run a helper command in the terminal"
- `$...` means "run a Meta-Architect skill inside the Codex session"

Important:
- `ma setup` and `ma init` currently do the same thing
- they only create local support files
- they do not replace the in-session skill flow

Manager contract:
- `$maestro` is the only umbrella in-session surface
- `$maestro` manages the next allowed step, but gated outputs still belong to `$arch -> $sage -> $flow -> $vet -> $vibe -> $build`
- helper skills are publishable mirrors that can assist a lane, but they do not move release gates
- `ma run '$maestro' --auto-heal --parallel` enables the bounded runtime repair path and records conductor state in the private scratchpad layer when eligible
- `ma verify --architect` runs an external architect reviewer command when `MA_ARCHITECT_REVIEW_CMD` is configured

## Installed support bundle

Meta-Architect also installs a standard packaged support bundle for relevant files.

Default path:

```text
~/.codex/meta-architect-sdk/
```

Use:

```bash
ma sdk-path
```

when you want the exact active path.

Relevant packaged assets there include:
- `mcp/`
- `sprint/`
- `prompts/`
- `scripts/`
- `plugins/meta-architect/`
- `templates/`
- native skill references such as `skills/maestro/references/`, `skills/sage/references/`, `skills/vet/references/`, `skills/align/references/`, and `skills/cleanup/references/`
- runtime scratchpad state such as `.ma/state/manager-runs.json` and `.ma/state/maestro-state.json` when local execution is active

This exists so Meta-Architect can use relevant packaged files without guessing paths.

## Shared output contract

Every skill result must include:
- `decision`
- `status`
- `evidence`
- `blockers`
- `next_allowed_triggers`

## Status ownership

- `$maestro` -> umbrella workflow management, next-step recommendation, and bounded helper/gate handoff
- project brief -> architecture input
- `$arch` -> `architecture_status`
- `$sage` -> `evidence_status`
- `$flow` -> `logic_status`
- `$vet` -> `security_status`
- `$vibe` -> `experience_status`
- `$build` -> `build_status`

`$maestro` may dispatch a gated lane, but it does not own that lane's artifact or release-state field. Helper skills do not own release-state fields. They are publishable but non-gating, so they support the current lane and then hand work back to `$maestro` or the gated lane that owns the decision.

## Operator note

The in-session skill surface is primary. The `ma` terminal helper commands only exist to start Codex context and to provide repo-local state automation when scripted verification is needed.
