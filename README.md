# Meta-Architect

Meta-Architect is a production-grade skills package and CLI for **programmatic architecture, evidence-backed OSS selection, gate-driven review, and release-minded build unlocking**.

It adds a disciplined workflow around an MCP-capable coding runtime instead of replacing the runtime itself.

[!NOTE]
**Meta-Architect `v0.1.0` is not an MVP-lite line.**  
The version describes product scope, not engineering seriousness. From `v0.1.0` onward, the package is expected to ship with stable skill contracts, deterministic packaging, explicit release gates, honest evidence rules, and no accidental runtime-state leakage.

## At a glance

| Surface | Value |
| --- | --- |
| npm package | `@jstn-sdk/meta-architect-skills` |
| CLI commands | `meta-architect`, `ma` |
| Node requirement | `>=20` |
| Package manager | `npm@10` |
| Current release line | `v0.1.0` |
| License | [MIT](./LICENSE) |

## What problem it solves

Meta-Architect is for teams that do **not** want to jump straight from an idea to implementation with no structure.

It gives you:

- an explicit architecture lane before coding
- live OSS evidence checks through GitMCP-backed sources
- business-logic, security, and DX/UX gates before build execution
- reproducible skill packaging instead of ad-hoc prompt files
- a CLI and skill bundle that can be installed, validated, packed, and shipped like a real product

If you only want a freeform coding chat, Meta-Architect is probably unnecessary. If you want an AI workflow that behaves more like an **architect + reviewer + release gate**, this package is the intended layer.

## Core workflow

| Trigger | Purpose | Primary output | Gate effect |
| --- | --- | --- | --- |
| `$arch` | Produce the first-pass architecture blueprint | architecture decision entry | `architecture_status = APPROVED` |
| `$sage` | Bind major choices to configured GitMCP evidence | evidence source records | `evidence_status = VERIFIED | PARTIAL | MISSING` |
| `$flow` | Review baseline logic and state transitions | logic review decision | `logic_status = GREEN | RED` |
| `$vet` | Run baseline security and dependency review | audits + CVE records | `security_status = GREEN | RED` |
| `$vibe` | Review developer and user experience implications | DX/UX outcome record | `experience_status = GREEN | RED | WAIVED` |
| `$build` | Unlock bounded implementation planning | build-ready decision | `build_status = READY` |

## Gate model

Meta-Architect is intentionally **fail-closed**.

| Status | Meaning |
| --- | --- |
| `CLEAR` | the lane has enough input to proceed |
| `APPROVED` | the architecture lane has produced an acceptable first-pass blueprint |
| `VERIFIED` | live evidence was successfully grounded through approved GitMCP sources |
| `PARTIAL` | evidence config exists, but live proof is incomplete or unavailable |
| `GREEN` | the lane passed its current baseline review |
| `RED` | the lane is blocked or failed its current baseline review |
| `WAIVED` | the lane was intentionally waived with an explicit recorded reason |
| `LOCKED` | downstream work is not allowed yet |
| `READY` | the next gated action is allowed |

`$build` is locked until upstream states satisfy the release contract recorded in `.omx/release.json`.

## Installation

### Public install path

```bash
npm install -g @jstn-sdk/meta-architect-skills
```

This installs the public CLI entrypoints:

```bash
ma
meta-architect
```

[!NOTE]
The package publishes both the CLI and the canonical `skills/` bundle. It does **not** publish local `.omx` runtime state, logs, caches, or contributor-only workflow residue.

### Recommended current install path: source checkout

Use this path if you want to edit the repository itself.

```bash
git clone https://github.com/JustineDevs/meta-architect.git
cd meta-architect
npm install
npm link
```

`npm link` makes the local `ma` command available without requiring npm publication first.

### Install path comparison

| Path | Use when | Commands |
| --- | --- | --- |
| npm global install | you want the published consumer path | `npm install -g @jstn-sdk/meta-architect-skills` |
| source clone + link | you want to use or develop Meta-Architect immediately | `git clone ... && npm install && npm link` |
| local package inspection | you want to inspect the exact publish surface | `npm pack --dry-run` |

[!WARNING]
Meta-Architect is designed around a Unix-like shell, Git, Node.js, and an MCP-capable runtime. Native Windows is possible, but the recommended default remains macOS, Linux, or WSL2.

## Quickstart

### 1. Initialize a repo

Run this inside the repository you want Meta-Architect to govern:

```bash
ma init
```

Expected output:

```text
meta-architect init
===================
ready: .codex/agents
ready: .codex/prompts
ready: .omx/skills
ready: .omx/evidence
ready: mcp
ready: docs
ready: docs/qa
ready: sprint
```

### 2. Register approved GitMCP sources

Edit `mcp/servers.json` and register real repository-backed endpoints:

```json
{
  "category": "meta-list",
  "repo": "sindresorhus/awesome",
  "endpoint": "https://gitmcp.io/sindresorhus/awesome"
}
```

Recommended starter set:

- `https://gitmcp.io/sindresorhus/awesome`
- `https://gitmcp.io/dzharii/awesome-typescript`
- `https://gitmcp.io/sbilly/awesome-security`

[!NOTE]
The build-unlocking evidence policy accepts repository-form GitMCP endpoints such as `https://gitmcp.io/{owner}/{repo}`. A documentation URL such as `https://gitmcp.io/docs` is not treated as VERIFIED release evidence.

### 3. Capture the idea

```bash
ma idea "Build a real-time collaborative whiteboard for product teams"
```

Expected effect:

- appends an idea entry to `.omx/decisions.json`
- sets `idea_status = CLEAR`

### 4. Run the gated sequence

```bash
ma run '$arch'
ma run '$sage'
ma run '$flow'
ma run '$vet'
ma run '$vibe'
ma status
ma run '$build'
```

Expected green-state status before `$build`:

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

Expected build output:

```text
Build gate is green.
Suggested branches:
- feature/ui
- feature/api
Optional worktree commands:
git worktree add ../ui feature/ui
git worktree add ../api feature/api
```

## Release and publishing posture

Meta-Architect has two different distribution surfaces. They are related, but not interchangeable.

| Surface | Purpose | Produced by |
| --- | --- | --- |
| npm package | public installable package containing CLI, docs, scripts, and canonical skills | `npm publish` / `npm pack` |
| skills bundle | narrower tarball containing `skills/` only | `npm run skills:pack` |

Important commands:

```bash
npm run skills:manifest
npm run skills:validate
npm run skills:pack
npm run skills:install -- --path ./dist/installed-skills
npm run pack:inspect
```

Expected pre-publish rules:

- `skills/index.json` must be current
- `npm run skills:validate` must pass
- `dist/meta-architect-skills.tgz` must exist
- `npm pack --dry-run` must show the intended public package surface only
- docs must match the real CLI and release behavior

[!NOTE]
Meta-Architect does not claim a publish channel unless that channel has actually run. The repository may be release-ready before npm publication happens, but the docs should never pretend a channel is live when it is not.

## What the package contains

The public npm package is intentionally explicit.

| Included | Why |
| --- | --- |
| `bin/` | CLI entrypoints |
| `skills/` | canonical installable skill contracts |
| `docs/` | operator and publishing guidance |
| `scripts/` | packaging and validation helpers |
| `index.js` | programmatic exports |
| `README.md` | public package contract |
| `LICENSE` | package license |

| Excluded | Why |
| --- | --- |
| `.omx/` runtime state | local execution residue, not distributable product |
| local logs and caches | not part of the contract |
| contributor-only temp outputs | not stable public artifacts |

## Example release-minded flow

```bash
ma init
ma idea "Build a SaaS billing dashboard for small teams"
ma run '$arch'
ma run '$sage'
ma run '$flow'
ma run '$vet'
ma run '$vibe'
ma run '$build'
ma merge feature/ui development
ma release development prod
```

What this does:

- records a first-pass architecture blueprint
- grounds major choices in configured evidence sources
- blocks unsafe or incomplete release progression
- unlocks build planning only when the current gates allow it
- enforces merge and promotion origin rules

## Monorepo structure

The repository is a monorepo, but the product is centered on skills, prompts, packaging, and release discipline rather than a large library API.

| Path | Responsibility |
| --- | --- |
| `.codex/` | runtime prompts, hooks, and agent-facing repo guidance |
| `skills/` | canonical public skill contracts |
| `plugins/meta-architect/` | plugin-oriented distribution surface |
| `docs/` | operator, installation, publishing, and release documentation |
| `missions/` | reproducible scenario-driven workflows |
| `mcp/` | GitMCP endpoint and collection configuration |
| `scripts/` | validation, packing, and installation helpers |
| `sprint/` | human-readable phased workflow documents |

## Documentation map

| Surface | Purpose |
| --- | --- |
| [Getting Started](./docs/getting-started.md) | end-to-end local onboarding |
| [Skills Reference](./docs/skills.md) | trigger-by-trigger contract guide |
| [Skills Publishing](./docs/skills-publishing.md) | source-to-package pipeline |
| [MCP Setup](./docs/mcp-setup.md) | evidence endpoint policy |
| [Plugin README](./plugins/meta-architect/README.md) | plugin distribution surface |
| [Collaborative Whiteboard Mission](./missions/collaborative-whiteboard/mission.md) | concrete scenario walkthrough |
| [Release Spec](./docs/release-spec.md) | release and gate policy |
| [Release Readiness](./docs/qa/release-readiness-0.1.0.md) | QA evidence for the `v0.1.0` line |

## For package consumers

Use Meta-Architect when you want:

- a real installable skill bundle
- explicit architecture and evidence lanes
- deterministic release gating
- a CLI that can be used directly from a published package

Do not use Meta-Architect if your expectation is:

- hidden magic without local state files
- unrestricted build execution before review lanes run
- vague or unverifiable OSS recommendations
- release claims without evidence

## Maintainer and release hygiene

The repository follows strict release-sensitive hygiene:

- runtime `.omx` logs, state, tmp, and cache files must not be shipped
- public docs must match actual package behavior
- publish statements must match reality
- release channels must not be claimed before they succeed
- skill contracts must stay aligned across canonical and plugin-facing copies

## License

[MIT](./LICENSE)
