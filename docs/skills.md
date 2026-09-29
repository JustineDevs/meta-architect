# Skills

Meta-Architect ships three in-session skill layers:

<table>
  <tr><th>Layer</th><th>Skills</th><th>Purpose</th></tr>
  <tr><td>Manager</td><td><code>$maestro</code></td><td>Chooses the next locally eligible action.</td></tr>
  <tr><td>Gated lanes</td><td><code>$arch</code>, <code>$sage</code>, <code>$flow</code>, <code>$vet</code>, <code>$vibe</code>, <code>$build</code></td><td>Own release-state decisions and artifacts.</td></tr>
  <tr><td>Helpers</td><td><code>$align</code>, <code>$diagnose</code>, <code>$tdd</code>, <code>$cleanup</code></td><td>Support work without moving release gates.</td></tr>
</table>

The `$arch` lane also uses the [Software Architecture Guild reference](./reference/software-architecture-guild.md)
by default when comparing architecture styles. It records the selected style,
tradeoffs, rejected alternatives, and source citation before handing off to
`$sage`.

Architecture vocabulary is kept in the bounded [system design glossary](./reference/system-design-glossary.md).
The glossary makes recurring design terms explicit without pretending that
definitions replace project-specific reasoning or source evidence.

<table>
  <tr><th>Lane</th><th>Default dossier</th><th>Purpose</th></tr>
  <tr><td><code>$arch</code></td><td><a href="./reference/software-architecture-guild.md">Architecture styles</a></td><td>Choose and justify the simplest applicable style.</td></tr>
  <tr><td><code>$sage</code></td><td><a href="./reference/technology-evidence.md">Technology evidence</a></td><td>Inventory the stack, map capabilities and variables, then pin upstream facts before approving a technology.</td></tr>
  <tr><td><code>$flow</code></td><td><a href="./reference/reliability-and-recovery.md">Reliability and recovery</a></td><td>Make failure, retry, and recovery behavior explicit.</td></tr>
  <tr><td><code>$vet</code></td><td><a href="./reference/security-verification.md">Security verification</a></td><td>Map threats to verifiable controls.</td></tr>
  <tr><td><code>$vibe</code></td><td><a href="./reference/accessibility-and-usability.md">Accessibility and usability</a></td><td>Verify accessible, understandable journeys.</td></tr>
  <tr><td><code>$build</code></td><td><a href="./reference/supply-chain-readiness.md">Supply-chain readiness</a></td><td>Verify artifact provenance and release boundaries.</td></tr>
</table>

The package does not ship a separate `$meta-architect` in-session skill. `$maestro` is the autonomous decision surface: it evaluates the current task and evidence, chooses one locally eligible action, dispatches the owning lane, and records the result. The user does not need to name the next lane.

## Jev decision core

Live Maestro routing uses TypeSafe Jev as its typed decision provider when a key
is configured. If no key is available, Maestro automatically uses its bounded
local policy so setup, lane execution, verification, and receipts still work.
Configure the server-side key once for live Jev routing:

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
change release ownership, or execute arbitrary text. Missing credentials select
the local policy and record `provider: "local"` with `provider use: not
verified`. A request failure after Jev has been selected still fails closed.
Tests and explicitly offline environments may select local routing with
`MAESTRO_DECISION_PROVIDER=local`; the legacy
`MAESTRO_DECISION_PROVIDER=deterministic` alias remains supported.

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
<table>
  <tr><th>Asset</th><th>Purpose</th></tr>
  <tr><td><code>mcp/</code>, <code>sprint/</code>, <code>prompts/</code>, <code>scripts/</code></td><td>Packaged workflow and verification support.</td></tr>
  <tr><td><code>plugins/meta-architect/</code>, <code>templates/</code></td><td>Host-facing plugin and project templates.</td></tr>
  <tr><td><code>skills/*/references/</code></td><td>Native references used by selected skill surfaces.</td></tr>
  <tr><td><code>.ma/state/</code></td><td>Runtime scratchpad state when local execution is active.</td></tr>
</table>

This exists so Meta-Architect can use relevant packaged files without guessing paths.

## Shared output contract

Every skill result must include:
<table>
  <tr><th>Field</th><th>Meaning</th></tr>
  <tr><td><code>decision</code></td><td>Decision made by the owning workflow.</td></tr>
  <tr><td><code>status</code></td><td>Current result state.</td></tr>
  <tr><td><code>evidence</code></td><td>Proof supporting the result.</td></tr>
  <tr><td><code>blockers</code></td><td>Conditions preventing the next step.</td></tr>
  <tr><td><code>next_allowed_triggers</code></td><td>Safe follow-up actions.</td></tr>
</table>

## Status ownership

<table>
  <tr><th>Owner</th><th>Owned responsibility</th></tr>
  <tr><td><code>$maestro</code></td><td>Workflow management and bounded handoff.</td></tr>
  <tr><td>Project brief</td><td>Architecture input.</td></tr>
  <tr><td><code>$arch</code></td><td><code>architecture_status</code></td></tr>
  <tr><td><code>$sage</code></td><td><code>evidence_status</code></td></tr>
  <tr><td><code>$flow</code></td><td><code>logic_status</code></td></tr>
  <tr><td><code>$vet</code></td><td><code>security_status</code></td></tr>
  <tr><td><code>$vibe</code></td><td><code>experience_status</code></td></tr>
  <tr><td><code>$build</code></td><td><code>build_status</code></td></tr>
</table>

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
