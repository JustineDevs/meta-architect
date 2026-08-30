# Getting Started

This guide takes Meta-Architect from install to a green-gated skill workflow on a real project.

## Goal

By the end of this guide you should be able to:
- install Meta-Architect
- configure MCP/GitMCP sources
- run the full architecture-to-build sequence
- understand how each gate moves
- diagnose blocked gates
- use the merge/release path safely

## Prerequisites

- Node.js 20+
- npm 10+
- Git 2.30+
- an MCP-capable runtime
- network access if you want live `$sage` verification against a real GitMCP server

## 1. Default install and launch

Recommended CLI install for macOS, Linux, WSL, and Git-Bash:

```bash
# One-line install (POSIX shells only; use WSL/Git-Bash on Windows)
curl -fsSLo install.sh https://cdn.jsdelivr.net/gh/JustineDevs/meta-architect@latest/scripts/install.sh && curl -fsSLo install.sh.sha256 https://cdn.jsdelivr.net/gh/JustineDevs/meta-architect@latest/scripts/install.sh.sha256 && sed 's#scripts/install.sh#install.sh#' install.sh.sha256 | sha256sum -c - && sh install.sh
```

The jsDelivr installer runs `npm i -g @openai/codex@latest @jstn-sdk/ma@latest`, then `ma setup`.
Use `sh install.sh --dry-run` to inspect the plan, `--no-setup` to skip local
runtime writes, or `--no-skills` to skip skill/support-bundle writes. The
installer prints Node/npm/Codex versions and an uninstall command after a real
install. npm installation is side-effect free; host selection and skill
installation happen explicitly during the first interactive `ma` launch.

Debian-family install:

```bash
sudo apt install ./meta-architect_<version>_all.deb
```

Arch-family install:

```bash
sudo pacman -U ./meta-architect-<version>-1-any.pkg.tar.xz
```

Fedora/openSUSE install:

```bash
sudo dnf install ./meta-architect-<version>-1.noarch.rpm
```

Default supported npm fallback:

On the first interactive `ma` launch, Meta-Architect detects supported CLI and
IDE host markers and asks once for the installation scope and targets. The
selection is recorded in `.ma/prelaunch.json`; CI and piped/non-interactive
launches skip the prompt and preserve the default Codex bootstrap behavior.

```bash
# Install
npm i -g @openai/codex@latest @jstn-sdk/ma@latest

# Launch
ma --madmax --high

# Remove Meta-Architect only
npm uninstall -g @jstn-sdk/ma

# Remove Meta-Architect and Codex
npm uninstall -g @jstn-sdk/ma @openai/codex
```

The jsDelivr CLI installer is the recommended quick-start path for POSIX shells. Linux-native distro packages remain supported release assets, and the npm path remains the canonical package install underneath the installer. The product experience is still the in-session skill workflow in [example/usage-workflow.md](../example/usage-workflow.md). The `ma` command is only a helper for starting or supporting that flow.

## 2. Real usage workflow

Start with `$maestro` when you want the bounded autonomous manager to inspect the workflow state and choose the next step. Start with the structured `$arch` prompt when you already know architecture is the next gated lane:

```text
$arch I want to build: [PROJECT IDEA]

Context:
- Product type: [web app / mobile app / API / marketplace / agent system / internal tool]
- Users: [who will use it]
- Core problem: [what problem it solves]
- Main features:
  1. [feature one]
  2. [feature two]
  3. [feature three]
- Constraints:
  - Budget: [low / medium / high]
  - Team size: [solo / small / medium]
  - Timeline: [e.g. 2 weeks MVP, 3 months beta]
  - Preferred stack: [optional]
  - Avoid: [optional]
- Quality priorities:
  - [e.g. speed, low cost, security, DX, maintainability, scalability]
- Deployment target:
  - [Vercel / Docker / VPS / AWS / GCP / local-first / hybrid]

Required output:
1. Problem framing
2. Recommended architecture
3. Stack decision with justification
4. System components and responsibilities
5. Data model and storage choices
6. Auth/security considerations
7. DX/UX considerations
8. Delivery plan for v0.14.1
9. Risks and trade-offs
10. Decision log
11. Exact next trigger to run after this
```

Then continue with:

```text
$sage
$flow
$vet
$vibe
$build
```

Use the full prompt blocks from [example/usage-workflow.md](../example/usage-workflow.md) when you want the exact handoff format between lanes.

Optional helper skills around that path:

```text
$align
$diagnose
$tdd
$cleanup
```

These helpers are publishable skills, but they do not change gate ownership, move release states, or replace the fixed release sequence.

## 3. Contributor clone and link

```bash
git clone https://github.com/JustineDevs/meta-architect.git
cd meta-architect
npm install
npm link
```

Why `npm link` matters:
- it makes the local helper command available without requiring a global publish step

## 4. Secondary repository setup flow

```bash
ma setup
```

Optional interactive session:

```bash
ma
```

Expected effects:
- `.codex/agents/` exists
- `.codex/prompts/` exists
- local `.ma/skills/`, `.ma/evidence/`, `.ma/context/`, `.ma/specs/`, `.ma/plans/`, and `.ma/runbook.md` are seeded
- `mcp/`, `docs/`, and `sprint/` surfaces exist
- `ma` opens Codex with the Meta-Architect helper posture when run with no arguments

`.ma/` is the canonical Meta-Architect project namespace. A legacy `.omx/` directory may
exist for oh-my-codex orchestration history, but new MA setup and generated guidance never
use it as runtime state.

Expected output:

```text
meta-architect setup
====================
ready: .codex/agents
ready: .codex/prompts
ready: .ma/skills
ready: .ma/evidence
ready: .ma/context
ready: .ma/specs
ready: .ma/plans
ready: mcp
ready: docs
ready: docs/qa
ready: sprint
```

This setup path is secondary to the canonical in-session skill workflow. Use it when you need local repo scaffolding.

## 4.1 Understand the two surfaces

Meta-Architect works in two simple ways:

- terminal commands
- in-session skills

The umbrella in-session entry point is `$maestro`. The package does not ship a separate `$meta-architect` skill surface.

Terminal commands are normal shell commands:

```bash
ma setup
ma init
ma sdk-path
ma status
ma run '$arch'
```

In-session skills are prompts used after you are already inside Codex:

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

Easy rule:
- `ma ...` = terminal helper command
- `$...` = in-session skill

Contract split:
- terminal helper commands support setup, local state, and scripted verification
- in-session skills are the product workflow surface
- `$maestro` is the only umbrella surface inside the session
- `$align`, `$diagnose`, `$tdd`, and `$cleanup` stay publishable but non-gating

`ma setup` and `ma init` currently do the same thing:
- they create local `.ma/` support files
- they prepare context, specs, plans, evidence, and runbook files
- they do not automatically run the skill workflow

`ma bootstrap` is the lazy-user path:
- it checks whether `codex` is callable
- it repairs installed skills and support-bundle assets when possible
- it runs local scaffold setup
- it can seed starter MCP files with `--init-mcp` when the local MCP config is empty or invalid
- it reports `READY`, `READY_WITH_WARNINGS`, or `BLOCKED`

`ma doctor` is the check-only path:
- it runs the same environment checks without changing files
- it prints the current readiness state and exact next step

Maintainers use `npm run package:doctor` (also available as
`npm run release:doctor`) for release and package artifact completeness. It
does not inspect the installed user environment; both commands use the same
status vocabulary so their scopes remain explicit.

`ma sdk-path` prints the installed packaged support-bundle root for relevant files such as prompts, MCP files, sprint files, scripts, plugin metadata, and templates.

## 5. Configure MCP / GitMCP

Edit:
- `mcp/servers.json`
- `mcp/collections.json`
- `mcp/fallback.json`

Minimum live example:

```json
{
  "category": "candidate",
  "repo": "owner/repo",
  "endpoint": "https://gitmcp.io/owner/repo"
}
```

Recommended source-selection posture:
- use the packaged native references to narrow candidate families first
- map serious candidates to exact upstream GitMCP repo endpoints
- verify final choices against upstream repos and official docs before treating them as approved evidence

Core discovery standard:
- use `https://ossium.live/home` to find trending OSS, curated repos, YC-backed repos, GSoC orgs, and contribution leads faster than browsing GitHub directly
- use `https://trendshift.io/` to spot repositories with rising engagement and topic momentum
- use `https://devhunt.org/` to discover newly launched developer tools
- use `https://libraries.io/` to inspect package/dependency metadata, while remembering its public data is scraped and not validated/curated for accuracy
- use `https://openhub.net/` to inspect project activity, contributor, popularity, and comparison signals
- use `https://www.opensourceprojects.dev/` to inspect curated OSS selections and detailed project writeups
- move any promising discovery result into `mcp/servers.json` as an exact upstream GitMCP repo endpoint before treating it as VERIFIED evidence

Useful native reference packs:
- `skills/maestro/references/native-ingest-map.md`
- `skills/sage/references/source-selection.md`
- `skills/vet/references/security-playbooks.md`

Canonical `$sage` order:
- known upstream repo/docs first
- discovery accelerators second
- exact GitMCP repo mapping third
- upstream repo + official-doc verification last

See [docs/mcp-setup.md](./mcp-setup.md) for endpoint policy and evidence semantics.

## 6. Secondary helper flow

```bash
ma idea "Prepare Meta-Architect v0.14.1 for a production package release with real install docs, Obsidian brain-context support, learning-loop reliability, and package proof artifacts."
```

Expected effects:
- an idea decision entry is appended to `.ma/decisions.json`
- `idea_status = CLEAR`

If this fails:
- ensure the idea text is not empty
- inspect `.ma/decisions.json` for malformed local data

## 7. Run the helper skill sequence

### 7.1 Autonomous manager

```bash
ma run '$maestro'
```

Expected effects:
- reads the current gate state
- acts as the bounded umbrella in-session workflow manager
- recommends the best next step or lane assignment
- can hand work to a publishable non-gating helper skill when that is enough
- does not move release gates by itself
- writes `.ma/plans/maestro.md`
- records an advisory decision entry

Generated or updated:
- `.ma/decisions.json`
- `.ma/plans/maestro.md`

Optional non-gating helper skills that can run before or between gated lanes:
- `$align` for scope/language cleanup
- `$diagnose` for blocked-lane triage
- `$tdd` for regression-first execution setup
- `$cleanup` for simplification and final-pass polish

### 7.2 Architecture

```bash
ma run '$arch'
```

Expected effects:
- a structured first-pass architecture blueprint is appended
- `architecture_status = APPROVED`

Generated or updated:
- `.ma/decisions.json`
- `.ma/release.json`
- `.ma/context/project.md`
- `.ma/specs/architecture.md`
- `.ma/plans/implementation.md`

### 7.3 Evidence

```bash
ma run '$sage'
```

Expected effects:
- `architecture_status` must already be approved
- configured GitMCP endpoints are validated
- the latest architecture summary is used as the probe query basis
- the first configured live source is probed when live mode is enabled
- `.ma/evidence/sources.json` is updated
- `evidence_status` becomes:
  - `VERIFIED` on a real successful live probe
  - `PARTIAL` when configured evidence exists but live proof is incomplete or disabled
  - `MISSING` when no usable approved source exists

Generated or updated:
- `.ma/evidence/sources.json`
- `.ma/decisions.json`
- `.ma/release.json`
- `.ma/specs/evidence.md`

If this fails:
- check endpoint URLs in `mcp/servers.json`
- ensure architecture was approved first
- verify network access
- rerun after correcting the endpoint or environment

### 7.4 Logic

```bash
ma run '$flow'
```

Expected effects:
- a structured first-pass logic/state review is appended
- `logic_status = GREEN` when current prerequisites and transition modeling are acceptable
- `logic_status = RED` when prerequisite gates are not ready

Generated or updated:
- `.ma/specs/logic.md`

### 7.5 Security

```bash
ma run '$vet'
```

Expected effects:
- `.ma/evidence/audits.json` and `.ma/evidence/cves.json` are updated
- `security_status = GREEN` on a baseline pass
- `security_status = RED` when prerequisite gates are not ready

Generated or updated:
- `.ma/specs/security.md`

### 7.6 Experience

```bash
ma run '$vibe'
ma run '$vibe' --waive --reason "Accepted for this release line"
```

Expected effects:
- `.ma/evidence/outcomes.json` is updated
- `experience_status = GREEN` on a baseline pass
- `experience_status = RED` when prerequisite gates are not ready
- `experience_status = WAIVED` when the waiver path is used explicitly

Generated or updated:
- `.ma/specs/experience.md`

## 8. Inspect gate status

```bash
ma status
```

Expected green-state output:

```text
Meta-Architect Status
=====================
Idea: CLEAR
Architecture: APPROVED
Evidence: VERIFIED
Logic: GREEN
Security: GREEN
Experience: GREEN
Build: LOCKED
Next allowed triggers:
$build
```

## 9. Unlock and run build planning

```bash
ma run '$build'
```

Expected effects:
- build gate is evaluated
- if allowed, `build_status = READY`
- branch suggestions are printed
- worktree commands are suggested
- `.ma/plans/build.md` is updated

Expected output shape:

```text
Build gate is green.
Suggested branches:
- feature/implementation
- feature/verification
Optional worktree commands:
git worktree add ../implementation feature/implementation
git worktree add ../verification feature/verification
```

If `$build` fails:
- run `ma status`
- read the blocking statuses
- fix the corresponding upstream lane
- rerun that lane, then rerun `$build`

## 10. Example walkthrough: MA release hardening

```bash
ma setup
ma idea "Prepare Meta-Architect v0.14.1 for a production package release with real install docs, Obsidian brain-context support, learning-loop reliability, and package proof artifacts."
ma run '$arch'
ma run '$sage'
ma run '$flow'
ma run '$vet'
ma run '$vibe'
ma status
ma run '$build'
```

If you want an interactive Codex session during the walkthrough, start it separately with `ma`.

What should happen:
- `$arch` records the architecture and release-hardening blueprint
- `$sage` binds package, Obsidian, prompt-strategy, and MCP choices to configured evidence sources
- `$flow` records state-transition and gate-order review
- `$vet` records security, package exposure, and provider-bound context review
- `$vibe` records operator/demo/docs usability guidance
- `$build` suggests bounded implementation and verification branches after gates pass

Canonical demo reference:
- [DEMO.md](../DEMO.md)

## 11. Merge and release path

After implementation work is complete:

```bash
ma merge feature/ui dev
ma release dev main
```

These commands record approval by default; they do not execute Git. Use
`--dry-run` to run preflight and print the exact merge command without changing
state, or `--execute` to run the checked, explicit merge on the target branch.
Both modes require a clean worktree and a valid source branch.

Expected effects:
- merge only succeeds for `feature/* -> dev`
- release only succeeds for `dev|release/* -> main`
- final statuses advance to:
  - `build_status = DONE`
  - `merge_status = MERGED_TO_DEVELOPMENT`
  - `release_status = SHIPPED_TO_PROD`

## 12. Files generated or updated during a normal run

- `.ma/decisions.json`
- `.ma/release.json`
- `.ma/evidence/sources.json`
- `.ma/evidence/audits.json`
- `.ma/evidence/cves.json`
- `.ma/evidence/outcomes.json`
- `.ma/context/project.md`
- `.ma/context/recording-core.json`
- `.ma/context/learning-loop-core.json`
- `.ma/context/workspace-context-pack.json`
- `.ma/context/workspace-effectiveness.json`
- `.ma/context/prompt-strategy-core.json`
- `.ma/context/context-economy-core.json`
- `.ma/context/obsidian-bridge.json`
- `.ma/specs/architecture.md`
- `.ma/specs/evidence.md`
- `.ma/specs/logic.md`
- `.ma/specs/security.md`
- `.ma/specs/experience.md`
- `.ma/plans/implementation.md`
- `.ma/plans/build.md`
- `.ma/runbook.md`

These are local product artifacts created by the runtime. They are not a reason to bypass gate logic manually.

## 13. If a gate fails

Rule:
- do not edit statuses manually
- rerun the correct upstream command
- use `ma status` as the authority

Common examples:
- `evidence_status = MISSING` -> fix `mcp/servers.json`, rerun `$sage`
- `logic_status = RED` -> fix upstream evidence/architecture issues, rerun `$flow`
- `security_status = RED` -> resolve issues surfaced by `$vet`
- `experience_status = RED` -> rerun `$vibe` after clearing prerequisites
- `experience_status = WAIVED` -> verify the waiver reason recorded in `.ma/release.json`

## Related docs

- [README.md](../README.md)
- [Skills Reference](./skills.md)
- [MCP Setup](./mcp-setup.md)
- [Release Spec](./release-spec.md)
- [Skills Publishing](./skills-publishing.md)
- [Plugin Bundle](../plugins/meta-architect/README.md)
