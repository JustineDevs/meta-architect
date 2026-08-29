# Meta-Architect Demo Guide

Last verified: 2026-06-03
Release line: `v0.14.0`
Package: `@jstn-sdk/ma`

This demo uses a real existing project: this Meta-Architect repository.
It highlights how MA helps a workspace move from idea and context to gated architecture, evidence, review, build readiness, package proof, and release hygiene.

## What this proves

| Capability area | Real project surface |
| --- | --- |
| Core & Orchestration | `$maestro`, `.ma/state/manager-runs.json`, `.ma/state/maestro-state.json` |
| Memory & Knowledge | `.ma/memory/notes.md`, `.ma/context/project.md`, `.ma/context/learning-loop-core.json` |
| Intelligence & Learning | `.ma/context/prompt-strategy-core.json`, `.ma/context/context-economy-core.json`, `.ma/context/workspace-effectiveness.json` |
| Code Quality & Testing | `npm test`, `npm run check`, `test/*` |
| Security & Compliance | `$vet`, `.ma/specs/security.md`, `.ma/evidence/audits.json`, redaction gateway |
| Architecture & Methodology | `$arch`, `.ma/specs/architecture.md`, `.ma/decisions.json` |
| DevOps & Observability | `npm run release:check`, `.ma/hooks/audit.log`, `.ma/runbook.md` |
| Extensibility | `skills/`, `plugins/meta-architect/`, `mcp/servers.json`, Obsidian plugin bridge |
| Domain-Specific | real MA release/package workflow, clone-data proof files, Obsidian vault context boundaries |

> [!IMPORTANT]
> This is not a mock demo.
> The commands below use the current package scripts, seeded `.ma` runtime files, real skill contracts, and package dry-run output.

## 1. Install and enter MA

Recommended POSIX install:

```bash
curl -fsSLo install.sh https://cdn.jsdelivr.net/gh/JustineDevs/meta-architect@latest/scripts/install.sh && curl -fsSLo install.sh.sha256 https://cdn.jsdelivr.net/gh/JustineDevs/meta-architect@latest/scripts/install.sh.sha256 && sed 's#scripts/install.sh#install.sh#' install.sh.sha256 | sha256sum -c - && sh install.sh
```

Canonical npm fallback:

```bash
npm i -g @openai/codex@latest @jstn-sdk/ma@latest
ma --madmax --high
```

Remove only MA:

```bash
npm uninstall -g @jstn-sdk/ma
```

Remove MA and Codex:

```bash
npm uninstall -g @jstn-sdk/ma @openai/codex
```

Expected result:

- `ma` launches the Codex runtime posture.
- the MA skill surface is installed into the active Codex home.
- the in-session workflow can start with `$maestro`.

## 2. Run the real repo-local setup

Use this when demonstrating from a source checkout.

```bash
git clone https://github.com/JustineDevs/meta-architect.git
cd meta-architect
npm install
npm link
ma setup
ma doctor
ma status --maestro-view
```

Expected seeded runtime files include:

| Runtime file | Why it matters |
| --- | --- |
| `.ma/release.json` | release gate source of truth |
| `.ma/decisions.json` | lane decision log |
| `.ma/context/recording-core.json` | semantic recording map |
| `.ma/context/learning-loop-core.json` | verified-learning loop across reliability domains |
| `.ma/context/obsidian-bridge.json` | Obsidian brain-context boundary |
| `.ma/context/prompt-strategy-core.json` | prompt strategy policy |
| `.ma/context/context-economy-core.json` | terse-output/context-budget policy |
| `.ma/context/workspace-context-pack.json` | shared workspace intelligence |
| `.ma/context/environment-awareness-core.json` | existing skill, MCP, and plugin capability inventory |
| `.ma/context/universal-plugin-broker-core.json` | hybrid MCP + MA skill plugin broker contract |
| `.ma/evidence/semantic-receipts.json` | semantic receipt registry |
| `.ma/runbook.md` | local helper workflow |

## 3. Demo the MA release-hardening workflow

Scenario: make this repository release-ready without bypassing architecture, evidence, logic, security, DX, or build gates.

Terminal helper path:

```bash
ma idea "Prepare Meta-Architect v0.14.0 for a production package release with real install docs, Obsidian brain-context support, learning-loop reliability, and package proof artifacts."
ma run '$maestro'
ma status --maestro-view
```

Direct in-session path inside Codex:

```text
$maestro
$arch
$sage
$flow
$vet
$vibe
$build
```

Expected behavior:

- `$maestro` chooses the next safe lane instead of passively asking what to do.
- `$arch` records architecture intent and constraints.
- `$sage` separates technical evidence from discovery or vault context.
- `$flow` checks logic/state transitions.
- `$vet` preserves security and compliance blockers.
- `$vibe` reviews developer/user experience risk.
- `$build` stays locked until upstream gates are green.

## 4. Demo learning loop reliability

The learning loop turns verified outcomes into future reliability context.
It does not auto-promote guesses.

```bash
node --test test/learning-loop-core.test.js
node -e "import('./index.js').then(({createDefaultLearningLoopCore, evaluateLearningLoopReadiness}) => console.log(evaluateLearningLoopReadiness(createDefaultLearningLoopCore())))"
```

Expected:

- all nine reliability domains exist
- candidate learnings cannot mutate release state
- verified learnings require source, evidence, authority, and next verification

## 5. Demo Obsidian as brain context, not build evidence

MA treats Obsidian notes as semantic brain context.
They can inform planning and workspace understanding, but they are not build evidence unless an owning lane promotes a claim with proof.

```bash
node --test test/obsidian-integration-core.test.js test/obsidian-plugin-bridge.test.js
```

Expected:

- vault notes are indexed as `vault_context`
- graph links are represented with Obsidian wikilinks
- plugin bridge APIs support active note context, frontmatter authority, request queue, attachments, protocol handling, rename-safe links, and metadata graph extraction
- plugin-side actions do not directly mutate `.ma/release.json`, `.ma/decisions.json`, `.ma/plans/`, or `.ma/specs/`

## 6. Demo Ralph-style execution handoff

Ralph execution is a core execution contract after MA gates, not a separate release authority.

```bash
node --test test/ralph-execution-core.test.js
```

Expected:

- approved PRD/story contracts are story-sized
- progress is append-only and scoped
- execution cannot bypass `$arch -> $sage -> $flow -> $vet -> $vibe -> $build`

## 7. Demo context economy and prompt strategy

MA uses first-party context economy and prompt strategy cores to keep responses concise without removing technical precision, security warnings, schemas, or verification gaps.

```bash
node --test test/context-economy-core.test.js test/prompt-strategy-core.test.js
```

Expected:

- terse summaries preserve exact code, commands, warnings, and authority fields
- prompt techniques are selected through MA lane policy
- security and high-risk content bypasses unsafe compression

## 8. Demo extensibility and package surfaces

```bash
npm run skills:manifest
npm run plugin:sync
npm run skills:validate
npm run plugin:verify
npm run skills:pack
node --test test/skills-registry-export.test.js test/mcp-policy.test.js test/environment-awareness-core.test.js test/universal-plugin-broker-core.test.js
```

Expected:

- `skills/index.json` is current
- `plugins/meta-architect/skills/` mirrors `skills/`
- all public skills validate
- MCP policy prevents unsafe or ambiguous evidence surfaces
- cross-agent skill export uses canonical `.agents/skills` semantics where applicable
- Environment Awareness Core discovers repo-local skills, MCP servers, and plugin manifests as `available_capability`, never `build_evidence`
- Universal Plugin Broker Core installs local plugin bundles into an isolated MA home, generates executable MCP wrappers, injects detected Claude Code / Antigravity / Cursor / Codex configs, and exports MA context skills

## 9. Demo production package proof

```bash
npm run demo:smoke
node scripts/release-verify.js
npm run check
npm test
npm pack --dry-run --ignore-scripts --cache ./.npm-cache
```

Expected package proof:

- package name is `@jstn-sdk/ma`
- version line is `0.14.0`
- `npm run demo:smoke` creates a realistic Northstar Logistics workspace and Obsidian vault under `/tmp/ma-real-demo-*`
- the smoke writes `.ma/evidence/real-demo-smoke-proof.json` in that temporary workspace
- `DEMO.md` is included
- `COVERAGE.md` is included
- `data/clone-data.proof.json`, `data/clone-data.ledger.json`, and `data/clone-data.rvf` are included
- runtime state such as canonical `.ma/` (plus legacy `.omx/` orchestration state), `node_modules/`, `test/`, and local caches are excluded

## 10. Full release demo

For a buyer-facing walkthrough, use the real demo kit:

- [Real Demo Runbook](./docs/demo/REAL_DEMO_RUNBOOK.md)
- [Demo Story](./docs/demo/DEMO_STORY.md)
- [Prospect Checklist](./docs/demo/PROSPECT_CHECKLIST.md)

The strongest single command:

```bash
npm run release:check
```

What it proves:

- release metadata is coherent
- public install docs include jsDelivr and npm fallback paths
- skills manifest, plugin mirror, skill validation, and skill packing work
- Biome check passes
- full sequential test suite passes
- npm dry-run package contents are production-safe

## Current verified inventory

| Surface | Current reality |
| --- | --- |
| Release line | `v0.14.0` |
| Package | `@jstn-sdk/ma` |
| Public skills | 11 (`maestro`, `arch`, `sage`, `flow`, `vet`, `vibe`, `build`, `align`, `diagnose`, `tdd`, `cleanup`) |
| Runtime namespace | `.ma/` |
| Production data artifacts | `data/clone-data.proof.json`, `data/clone-data.ledger.json`, `data/clone-data.rvf` |
| Coverage artifact | `COVERAGE.md` |
| Obsidian plugin payload | `plugins/meta-architect/obsidian/` |
| Learning loop artifact | `.ma/context/learning-loop-core.json` |
| Helper orchestration artifact | `.ma/context/helper-orchestration-core.json` |
| Environment awareness artifact | `.ma/context/environment-awareness-core.json` |
| Universal plugin broker artifact | `.ma/context/universal-plugin-broker-core.json` |
| Package hygiene | `.npmignore` plus `package.json#files` allowlist |

## Troubleshooting

- If `ma --madmax --high` does not launch Codex, confirm `@openai/codex` is installed globally and callable on `PATH`.
- If `$sage` cannot verify evidence, inspect `mcp/servers.json` and use repository-form GitMCP endpoints such as `https://gitmcp.io/{owner}/{repo}`.
- If `$build` stays locked, run `ma status --maestro-view` and resolve the blocking gate.
- If Obsidian context looks empty, verify the vault path and that notes contain links, tags, headings, or frontmatter.
- If package output includes runtime state, inspect `.npmignore`, `package.json#files`, and `npm pack --dry-run`.
