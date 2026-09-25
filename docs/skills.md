# Skills

Meta-Architect ships three in-session skill layers:

- umbrella autonomous manager: `$maestro`
- gated execution lanes: `$arch`, `$sage`, `$flow`, `$vet`, `$vibe`, `$build`
- non-gating helper skills: `$align`, `$diagnose`, `$tdd`, `$cleanup`

The package does not ship a separate `$meta-architect` in-session skill. `$maestro` is the autonomous decision surface: it evaluates the current task and evidence, chooses one locally eligible action, dispatches the owning lane, and records the result. The user does not need to name the next lane.

## Jev decision core

Live Maestro routing uses TypeSafe Jev as its typed decision provider. Configure
the server-side key once for your user account:

```bash
ma auth typesafe
ma auth typesafe --status
```

The credential is stored owner-only in
`~/.config/meta-architect/provider.env` (or
`$XDG_CONFIG_HOME/meta-architect/provider.env`). For project-local dotenv
configuration, put `TYPESAFE_API_KEY` and optional provider settings in
`.env.local`; `.env.local` overrides `.env`, and explicit process environment
variables override both. Never commit either dotenv file.

For CI or a single ephemeral command, an environment variable remains
supported:

```bash
TYPESAFE_API_KEY="jv_live_..." npm run test:maestro-live
```

Maestro sends a bounded state object and a typed `choice` question to
`https://api.typesafe.ai/v1/systemone`. Jev can select only from actions that the
local release state has already proven safe. It cannot bypass prerequisites,
change release ownership, or execute arbitrary text. Missing credentials fail
with an actionable error. Tests and explicitly offline environments may opt into
the deterministic policy with `MAESTRO_DECISION_PROVIDER=deterministic`.

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
1. Start with `$maestro` when you want Meta-Architect to autonomously route and execute the next safe action
2. Provide the project goal and let Maestro repeat the decision/execute/verify loop
3. Use a named lane only when you intentionally need to inspect or rerun that lane directly
4. Use `$align`, `$diagnose`, `$tdd`, or `$cleanup` as non-gating helpers when a persisted receipt calls for them

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
- `$maestro` decides the next eligible action; gated outputs still belong to the owning lane and its local prerequisites
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

## Discovery and improvement

Maestro uses two explicit workflow contracts when it works with existing skills:

- **Chai Discovery**: collect readable project-local and user-global skill surfaces,
  classify their scope and type, rank them against the task, compose referenced
  skills in dependency order, and record the host boundary. The resulting plan is
  written to `.ma/context/skill-composition-plan.json`.
- **Skill execution**: before Maestro dispatches a task, it reads every selected
  `SKILL.md` in dependency order into a bounded, read-only instruction packet.
  The operation writes a receipt under `.ma/tasks/skill-execution-receipts/` and
  records the receipt reference in the task contract. `loaded` means the
  instruction context was made available to the owning workflow; it does not
  mean a vendor-native command was invoked.
- **Kaizen**: after a lane runs, use fresh test, build, security, or runtime
  evidence to check the result. A failed check produces a bounded reroute and a
  new attempt; a completed attempt records the outcome without silently changing
  policy. Cycles are appended to `.ma/learning/skill-kaizen.ndjson`.

This lets a task combine unrelated installed skills when their descriptions or
declared references make them relevant, while preserving ownership: Meta-Architect
does not copy, modify, or claim third-party skills. A vendor host receipt is still
required before a selected capability is reported as vendor-native execution.

## Operator note

The in-session skill surface is primary. The `ma` terminal helper commands only exist to start Codex context and to provide repo-local state automation when scripted verification is needed.
