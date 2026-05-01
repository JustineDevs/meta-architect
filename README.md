<div align="center">
  <img src="./docs/assets/meta-architect-mark.svg" alt="Meta-Architect mark" width="148" height="148">
  <h1>Meta-Architect</h1>
  <p>Production-grade skills package and CLI for programmatic architecture, evidence-backed OSS selection, gate-driven review, and release-minded build unlocking.</p>
  <p>
    <img src="https://img.shields.io/badge/npm-%40jstn--sdk%2Fmeta--architect--skills-CB3837" alt="npm package">
    <img src="https://img.shields.io/badge/node-%3E%3D20-339933" alt="Node.js 20+">
    <img src="https://img.shields.io/badge/release-v0.1.0-2563EB" alt="Release v0.1.0">
    <img src="https://img.shields.io/badge/license-MIT-16A34A" alt="MIT License">
  </p>
</div>

> [!IMPORTANT]
> Meta-Architect `v0.1.0` is a serious production-grade skills line.
> The version describes scope, not engineering looseness.
> From `v0.1.0` onward, the package is expected to ship with stable skill contracts, deterministic packaging, explicit release gates, and honest publish/install surfaces.

## Overview

<table>
  <tr>
    <td><strong>npm package</strong></td>
    <td><code>@jstn-sdk/meta-architect-skills</code></td>
  </tr>
  <tr>
    <td><strong>CLI commands</strong></td>
    <td><code>ma</code>, <code>meta-architect</code></td>
  </tr>
  <tr>
    <td><strong>Runtime</strong></td>
    <td>Node.js <code>&gt;=20</code>, npm <code>@10</code></td>
  </tr>
  <tr>
    <td><strong>Release line</strong></td>
    <td><code>v0.1.0</code></td>
  </tr>
  <tr>
    <td><strong>License</strong></td>
    <td><a href="./LICENSE">MIT</a></td>
  </tr>
</table>

## What It Does

Meta-Architect is for teams that do not want to move directly from idea to implementation without structure.

It adds:

- an architecture-first workflow before coding
- evidence-backed OSS selection through GitMCP-connected sources
- explicit logic, security, and DX/UX gates before build execution
- installable skills and a reproducible package surface instead of loose prompt files

> [!NOTE]
> Meta-Architect does not replace your coding runtime.
> It wraps that runtime with architecture, evidence, review, and release discipline.

## Core Triggers

| Trigger | Purpose | Main output | Gate effect |
| --- | --- | --- | --- |
| `$arch` | Produce the first-pass architecture blueprint | decision entry | `architecture_status = APPROVED` |
| `$sage` | Ground major choices in configured GitMCP evidence | evidence records | `evidence_status = VERIFIED | PARTIAL | MISSING` |
| `$flow` | Review baseline logic and state transitions | logic review entry | `logic_status = GREEN | RED` |
| `$vet` | Run baseline security and dependency review | audit and CVE records | `security_status = GREEN | RED` |
| `$vibe` | Review developer and user experience implications | DX/UX outcome record | `experience_status = GREEN | RED | WAIVED` |
| `$build` | Unlock bounded build planning | build-ready decision | `build_status = READY` |

## Gate Model

Meta-Architect is intentionally fail-closed.

| Status | Meaning |
| --- | --- |
| `CLEAR` | enough input exists to proceed |
| `APPROVED` | the architecture lane produced an acceptable first-pass blueprint |
| `VERIFIED` | live evidence was grounded through approved GitMCP sources |
| `PARTIAL` | evidence is configured but live proof is incomplete or unavailable |
| `GREEN` | the current baseline review passed |
| `RED` | the lane is blocked or failed |
| `WAIVED` | the lane was intentionally waived with a recorded reason |
| `LOCKED` | downstream work is not allowed yet |
| `READY` | the next gated step is allowed |

> [!CAUTION]
> `$build` must stay locked until the upstream release state in `.omx/release.json` satisfies the gate contract.
> Meta-Architect is designed to stop on blockers rather than silently continue.

## Installation

### Recommended current path: source checkout

Use this path if you want to run or develop Meta-Architect immediately from the repository.

```bash
git clone https://github.com/JustineDevs/meta-architect.git
cd meta-architect
npm install
npm link
```

`npm link` makes `ma` and `meta-architect` available in your shell from the local checkout.

### Public package install path

This is the intended consumer command for the published package:

```bash
npm install -g @jstn-sdk/meta-architect-skills
```

> [!WARNING]
> Only treat the npm install command as active once npm publication for the scoped package has actually succeeded.
> The README should never imply a live public channel before the registry release exists.

### Install path summary

<table>
  <tr>
    <td><strong>Path</strong></td>
    <td><strong>Use when</strong></td>
    <td><strong>Command</strong></td>
  </tr>
  <tr>
    <td>Source checkout</td>
    <td>You want to use or develop the repository immediately</td>
    <td><code>git clone ... &amp;&amp; npm install &amp;&amp; npm link</code></td>
  </tr>
  <tr>
    <td>npm package</td>
    <td>You want the released consumer package</td>
    <td><code>npm install -g @jstn-sdk/meta-architect-skills</code></td>
  </tr>
  <tr>
    <td>Package inspection</td>
    <td>You want to inspect the exact npm package surface</td>
    <td><code>npm pack --dry-run</code></td>
  </tr>
</table>

> [!TIP]
> Use macOS, Linux, or WSL2 as the default environment.
> The package is designed around a Unix-like shell, Git, Node.js, and an MCP-capable runtime.

## Quickstart

### 1. Initialize a project

Run this in the repository you want Meta-Architect to manage:

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

### 2. Configure GitMCP sources

Add real repository-backed endpoints in `mcp/servers.json`.

Example:

```json
{
  "category": "meta-list",
  "repo": "sindresorhus/awesome",
  "endpoint": "https://gitmcp.io/sindresorhus/awesome"
}
```

Recommended starter endpoints:

- `https://gitmcp.io/sindresorhus/awesome`
- `https://gitmcp.io/dzharii/awesome-typescript`
- `https://gitmcp.io/sbilly/awesome-security`

> [!IMPORTANT]
> Verified release evidence must come from repository-form GitMCP endpoints such as `https://gitmcp.io/{owner}/{repo}`.
> A generic documentation endpoint such as `https://gitmcp.io/docs` does not count as VERIFIED evidence for build unlocking.

### 3. Record the idea

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

Expected status before `$build`:

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

## Release and Packaging

Meta-Architect has two related but different distribution surfaces.

| Surface | Purpose | Produced by |
| --- | --- | --- |
| npm package | public package containing CLI, docs, scripts, and canonical skills | `npm publish` or `npm pack` |
| skills bundle | narrower tarball containing `skills/` only | `npm run skills:pack` |

### Required packaging commands

```bash
npm run skills:manifest
npm run skills:validate
npm run skills:pack
npm run skills:install -- --path ./dist/installed-skills
npm run pack:inspect
```

### Pre-publish rules

- `skills/index.json` must be current
- `npm run skills:validate` must pass
- `dist/meta-architect-skills.tgz` must exist
- `npm pack --dry-run` must show only intended public files
- docs must match real CLI and release behavior

> [!CAUTION]
> Do not claim npm, GitHub release, or any other publish channel until that channel has actually succeeded.
> Release documentation must match reality, not intent.

## Package Surface

### Included

<table>
  <tr>
    <td><strong>Path</strong></td>
    <td><strong>Reason</strong></td>
  </tr>
  <tr>
    <td><code>bin/</code></td>
    <td>CLI entrypoints</td>
  </tr>
  <tr>
    <td><code>skills/</code></td>
    <td>canonical public skill contracts</td>
  </tr>
  <tr>
    <td><code>docs/</code></td>
    <td>operator and publishing guidance</td>
  </tr>
  <tr>
    <td><code>scripts/</code></td>
    <td>validation and packaging helpers</td>
  </tr>
  <tr>
    <td><code>index.js</code></td>
    <td>programmatic exports</td>
  </tr>
  <tr>
    <td><code>README.md</code></td>
    <td>public package contract</td>
  </tr>
  <tr>
    <td><code>LICENSE</code></td>
    <td>license surface</td>
  </tr>
</table>

### Excluded

<table>
  <tr>
    <td><strong>Path</strong></td>
    <td><strong>Reason</strong></td>
  </tr>
  <tr>
    <td><code>.omx/</code> runtime state</td>
    <td>local execution residue, not distributable product</td>
  </tr>
  <tr>
    <td>logs and caches</td>
    <td>not part of the public contract</td>
  </tr>
  <tr>
    <td>temp install outputs</td>
    <td>not stable release artifacts</td>
  </tr>
</table>

## Example Flow

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

This flow:

- records a first-pass architecture blueprint
- grounds major choices in configured evidence sources
- blocks unsafe or incomplete release progression
- unlocks build planning only when the gate state allows it
- enforces merge and promotion origin rules

## Repository Structure

<table>
  <tr>
    <td><strong>Path</strong></td>
    <td><strong>Responsibility</strong></td>
  </tr>
  <tr>
    <td><code>.codex/</code></td>
    <td>runtime prompts, hooks, and agent-facing repo guidance</td>
  </tr>
  <tr>
    <td><code>skills/</code></td>
    <td>canonical public skill contracts</td>
  </tr>
  <tr>
    <td><code>plugins/meta-architect/</code></td>
    <td>plugin-oriented distribution surface</td>
  </tr>
  <tr>
    <td><code>docs/</code></td>
    <td>installation, publishing, and release documentation</td>
  </tr>
  <tr>
    <td><code>missions/</code></td>
    <td>reproducible scenario-driven workflows</td>
  </tr>
  <tr>
    <td><code>mcp/</code></td>
    <td>GitMCP endpoint and collection configuration</td>
  </tr>
  <tr>
    <td><code>scripts/</code></td>
    <td>validation, packing, and install helpers</td>
  </tr>
  <tr>
    <td><code>sprint/</code></td>
    <td>human-readable phased workflow documents</td>
  </tr>
</table>

## Documentation

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

## Release Hygiene

> [!WARNING]
> Runtime `.omx` logs, state, tmp, and cache files must not be shipped.
> Public docs must match actual package behavior.
> Publish statements must match reality.
> Skill contracts must stay aligned across canonical and plugin-facing copies.

## License

[MIT](./LICENSE)
