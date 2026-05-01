# Meta-Architect (MA)

<p align="center">
  <!-- TODO: replace with real logo/character -->
  <img src="https://placehold.co/280x280?text=Meta-Architect" alt="Meta-Architect character" width="280">
  <br>
  <em>The AI OS for Programmatic Architecture &amp; Verified Engineering.</em>
</p>

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-enabled-blue)](https://modelcontextprotocol.io/docs/getting-started/intro)

</div>

Meta-Architect (MA) is a workflow layer for **Codex-style CLIs and MCP-enabled runtimes**. It keeps your existing LLM execution engine and adds:

- a **standard architectural workflow** driven by `$arch`, `$sage`, `$flow`, `$vet`, `$vibe`, and `$build`
- **MCP-connected OSS collections** as the “Library of Truth” via serverless GitMCP endpoints
- **strict security and release gates** before any build runs
- **optional linked git worktrees** for isolated, parallel implementation once a plan is approved

Production rule for `v1.0.0`:
- core workflows must be reliable end-to-end,
- the public skill/status/branch contract must be stable,
- and release evidence must exist in docs and packaged skills.

<table>
<tr>
<td><strong>🚨 CAUTION — RECOMMENDED DEFAULT: macOS or Linux with an MCP-capable CLI and Git.</strong><br><br><strong>Meta-Architect is designed and tuned around that path.</strong><br><strong>Native Windows is not the primary path, may require WSL2 or extra setup, and currently receives less support.</strong></td>
</tr>
</table>

---

## What Meta-Architect is for

Use Meta-Architect when you want your AI dev workflow to behave like a **system architect + auditor**, not a freeform “vibe coder”:

- Turn an idea into a **blueprinted architecture** with explicit tradeoffs.
- Select **proven OSS** from curated “awesome” collections exposed through GitMCP, not from model vibes.
- Run **business-logic, security, and DX/UX reviews** as first-class steps.
- Only then unlock **build execution**, optionally in isolated git worktrees, before merge and release.

If you just want a plain coding chat with no gates, you don’t need Meta-Architect.

---

## Core Maintainers

> TODO: fill in once maintainers are confirmed.

| Role | Name | GitHub |
| --- | --- | --- |
| Creator & Lead | Justine | [@Justinedevs](https://github.com/JustineDevs) |

---

## Recommended default flow

If you want the default MA experience, start in a repo that will host your project:

```bash
# 1. Initialize Meta-Architect in this repo
ma init
# 2. Register your GitMCP-backed OSS collections
# GitMCP exposes any GitHub repo as a remote MCP server via gitmcp.io/{owner}/{repo}
mcp add https://gitmcp.io/sindresorhus/awesome
mcp add https://gitmcp.io/dzharii/awesome-typescript
mcp add https://gitmcp.io/sbilly/awesome-security
# 3. Capture your idea
ma idea "Build a real-time collaborative whiteboard for product teams"
# 4. Run the core architectural workflow
ma run $arch
ma run $sage
ma run $flow
ma run $vet
ma run $vibe
# 5. Only after gates are GREEN, start the build
ma run $build
# 6. Enforce merge and release policy
ma merge feature/ui development
ma release development prod
```

Under the hood:

- MA uses **MCP** to discover tools, resources, and prompts from the connected GitMCP servers.
- Each skill is a **Codex/LLM skill** with a strict contract and evidence requirements.
- Decisions and statuses are logged into `.omx/decisions.json` for auditability.
- If configured, `$build` can spawn **linked Git worktrees** for bounded tasks like `ui`, `api`, `auth`, sharing the underlying repo while keeping separate working trees.
- `ma merge` and `ma release` enforce branch-origin policy before state promotion.

---

## A simple mental model

Meta-Architect does **not** replace your LLM or dev tools.

It adds a **verified engineering layer** around them:

- **MCP + GitMCP** give you a structured, live view of curated OSS and security sources instead of hardcoded integrations.
- **Skills** (`$arch`, `$sage`, `$flow`, `$vet`, `$vibe`, `$build`) turn that context into decisions and gates.
- **`.omx/`** stores architecture, evidence, gates, and release decisions.
- **Git worktrees** (optional) give each approved build task its own isolated working tree attached to the same repository.

Most users should think of Meta-Architect as **better project decisions + better gates + safer execution**, not as a general-purpose chatbot.

---

## Start here if you are new

1. **Install requirements**
   - Node.js 20+
   - Git 2.30+ with `git worktree` support
   - An MCP-capable LLM CLI (Codex-like tool) with auth configured in the same shell/profile.
2. **Initialize Meta-Architect**
   ```bash
   ma init
   ```
3. **Connect your OSS collections via GitMCP**
   - GitMCP turns any GitHub repo into an MCP server by swapping `github.com` → `gitmcp.io`.
   ```bash
   mcp add https://gitmcp.io/sindresorhus/awesome
   mcp add https://gitmcp.io/dzharii/awesome-typescript
   mcp add https://gitmcp.io/rust-unofficial/awesome-rust
   mcp add https://gitmcp.io/sbilly/awesome-security
   ```
4. **Verify skills are wired**
   ```bash
   ma skills
   ```
5. **Give MA an idea**
   ```bash
   ma idea "I want to build a SaaS billing dashboard for small teams"
   ```
6. **Run the gated workflow in order**
   ```bash
   ma run $arch   # architecture & stack
   ma run $sage   # proven OSS from GitMCP
   ma run $flow   # business logic & state
   ma run $vet    # security & CVEs
   ma run $vibe   # DX/UX implications
   ma status      # check gates
   ma run $build  # only if gates are GREEN
   ```
7. **Enforce merge and release policy**
   ```bash
   ma merge feature/ui development
   ma release development prod
   ```

---

## Recommended workflow

### The “System 2” skill surface

Inside a session, use the short, human-style triggers:

| Surface | Use it for |
| --- | --- |
| `$arch "idea..."` | Turn a product idea into a high-level blueprint and stack rationale. |
| `$sage` | Fetch proven OSS candidates from your MCP-connected “awesome” lists and security collections. |
| `$flow` | Map business logic and state transitions, highlight dead ends and missing failure paths. |
| `$vet` | Audit security posture, check libraries against security sources, and block unsafe plans. |
| `$vibe` | Review developer experience and user experience implications before you commit to the stack. |
| `$build` | When all gates are green, split work into tasks and (optionally) spawn isolated git worktrees for each bounded concern. |

Use `$build` only after `$arch`, `$sage`, `$flow`, and `$vet` have done their job.

Supporting commands:
- `ma init` scaffolds the repo shape and baseline files.
- `ma idea "..."` records the project brief and unlocks `$arch`.
- `ma skills` lists the core skill triggers.
- `ma merge <feature/*> development` enforces merge policy and marks merge state.
- `ma release <development|release/*> prod` enforces release-origin policy and marks release state.

---

## Monorepo layout (high-level)

Meta-Architect lives in a monorepo, but it is **not an SDK**. The core is skills, hooks, MCP mappings, and decision logs.

```text
meta-architect/
├── .codex/
│   ├── agents/
│   │   ├── Architect.toml
│   │   ├── Sage.toml
│   │   ├── Auditor.toml
│   │   ├── Flow.toml
│   │   ├── Vibe.toml
│   │   └── Builder.toml
│   ├── hooks.json
│   └── prompts/
│       ├── enforcement.md
│       ├── release-rules.md
│       └── skill-contract.md
│
├── .omx/
│   ├── skills/
│   │   ├── arch.skill.md
│   │   ├── sage.skill.md
│   │   ├── vet.skill.md
│   │   ├── flow.skill.md
│   │   ├── vibe.skill.md
│   │   ├── build.skill.md
│   │   └── sync.skill.md
│   ├── decisions.json
│   ├── release.json
│   └── evidence/
│       ├── sources.json
│       ├── audits.json
│       ├── cves.json
│       └── outcomes.json
│
├── mcp/
│   ├── servers.json
│   ├── collections.json
│   └── fallback.json
│
├── sprint/
│   ├── 00-idea.md
│   ├── 01-architecture.md
│   ├── 02-oss-evidence.md
│   ├── 03-logic.md
│   ├── 04-security.md
│   ├── 05-dx-ux.md
│   ├── 06-build-plan.md
│   └── 07-release.md
│
├── docs/
│   ├── README.md
│   ├── getting-started.md
│   ├── mcp-setup.md
│   ├── onboarding.md
│   ├── qa/
│   │   └── release-readiness-1.0.0.md
│   ├── release-spec.md
│   ├── skills.md
│   └── skills-publishing.md
│
└── package.json
```

- `.codex/` holds agent configs and hooks for your CLI runtime.
- `.omx/` holds MA skills and all decisions/status.
- `mcp/` declares GitMCP endpoints and collections.
- `sprint/` provides human-readable sprint path docs.

---

## Release architecture (mental model)

Meta-Architect enforces a **gated release path**:

1. **Idea** – captured via `ma idea`.
2. **Architecture ($arch)** – blueprint and stack, must be logged.
3. **Evidence ($sage)** – OSS mapping from GitMCP sources.
4. **Logic ($flow)** – business logic and state validation.
5. **Security ($vet)** – security posture and CVE checks.
6. **DX/UX ($vibe)** – developer and user experience implications.
7. **Build ($build)** – work split and isolated execution (optional worktrees).
8. **Merge & Release** – merge feature branches into `development`, optionally stabilize on an approved `release/*` branch, then promote to `prod` once gates are green.

Default branch policy:

- `feature/*` — task branches (may be used in worktrees).
- `development` — integration branch.
- `release/*` — optional stabilization branch before `prod`.
- `prod` — production-ready, deployable branch.

---

## Workspace and worktrees

When `$build` is allowed, MA can create **linked working trees** for bounded tasks. Git manages multiple working trees attached to the same repository while keeping branch work isolated.

Example:

```bash
# inside your repo
git worktree add ../ui feature/ui
git worktree add ../api feature/api
```

Each worktree:

- is a separate directory with its own `HEAD` and index,
- shares the underlying repo and history,
- can be independently edited and tested.

After merge back into `development`, remove the worktrees:

```bash
git worktree remove ../ui
git worktree remove ../api
```

---

## Enforcement philosophy

Meta-Architect is designed to be **fail-closed**:

- No `$build` without `$vet` and other required green gates.
- No recommendation without visible evidence from MCP/GitMCP.
- No direct release from a worktree or feature branch.
- No silent status upgrades.

If anything is unclear, MA should stop and show you **which gate is blocking** and why.

---

## Documentation

- [Getting Started](./docs/getting-started.md)
- [Skills Reference](./docs/skills.md)
- [Skills Publishing](./docs/skills-publishing.md)
- [MCP / GitMCP Setup](./docs/mcp-setup.md)
- [Release & Gate Spec](./docs/release-spec.md)
- [QA / Release Readiness](./docs/qa/release-readiness-1.0.0.md)
- [Release Body](./RELEASE.md)
- [Changelog](./CHANGELOG.md)

---

## License
[MIT](./LICENSE)

---

## Renovate

This repo uses Renovate to keep dependencies current during business hours.

- Update window: once per weekday in the configured timezone.
- Grouping: production dependencies and devDependencies are grouped separately.
- Automerge: only patch-level updates for `devDependencies` are auto-merged.

To disable Renovate for one package, add a `packageRules` entry in `renovate.json` with
`matchPackageNames` for that dependency and `"enabled": false`.
