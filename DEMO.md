# Meta-Architect Demo Guide

Last verified: 2026-05-02  
Registry state: `@jstn-sdk/meta-architect@0.1.0` was unpublished on `2026-05-02T10:55:40.950Z`
GitHub release: `v0.1.0` published on `2026-05-02T10:59:33Z`

## Canonical demo path

This is the real primary Meta-Architect flow:

```bash
npm i -g @openai/codex@latest @jstn-sdk/meta-architect@latest
ma --madmax --high
```

Then inside the Codex session:

```text
$arch
$sage
$flow
$vet
$vibe
$build
```

Meta-Architect is a skills-first Codex layer. The `ma` launcher is the canonical way to enter the Codex session with the Meta-Architect runtime posture attached.

## Demo 1: Installed package launch

Goal: prove the public package launches Codex through `ma`.

```bash
npm i -g @openai/codex@latest @jstn-sdk/meta-architect@latest
ma --madmax --high
```

Expected:
- `ma` delegates into the local `codex` binary
- the Meta-Architect skill surface is installed into the active Codex home
- the session is ready for `$arch -> $sage -> $flow -> $vet -> $vibe -> $build`

## Demo 2: Repository-local scaffold and helper path

Goal: prove the secondary repo-local workflow surfaces still work.

```bash
git clone https://github.com/JustineDevs/meta-architect.git
cd meta-architect
npm install
npm link
ma setup
ma skills
ma status
```

Expected `ma setup` output:

```text
meta-architect setup
====================
ready: .codex/agents
ready: .codex/prompts
ready: .ma/skills
ready: .ma/evidence
ready: mcp
ready: docs
ready: docs/qa
ready: sprint
```

Expected `ma skills` output:

```text
$arch
$sage
$flow
$vet
$vibe
$build
```

Expected clean `ma status` output:

```text
Meta-Architect Status
=====================
Idea: DRAFT
Architecture: DRAFT
Evidence: MISSING
Logic: PENDING
Security: PENDING
Experience: PENDING
Build: LOCKED
Next allowed triggers:
ma idea
$arch
$sage
$flow
$vet
$vibe
```

## Demo 3: Full helper workflow

Goal: prove the scripted helper path can drive the complete gate sequence.

```bash
ma idea "Build a real-time collaborative whiteboard for remote product teams"
ma run '$arch'
ma run '$sage'
ma run '$flow'
ma run '$vet'
ma run '$vibe'
ma status
ma run '$build'
```

Expected:
- `ma idea` sets `idea_status = CLEAR`
- `$arch` sets `architecture_status = APPROVED`
- `$sage` sets `evidence_status = VERIFIED` with a real live probe, or `PARTIAL`/`MISSING` when evidence is incomplete
- `$flow` sets `logic_status = GREEN`
- `$vet` sets `security_status = GREEN`
- `$vibe` sets `experience_status = GREEN`
- `ma status` exposes `$build` as the next allowed trigger once all prerequisites are satisfied
- `$build` prints suggested `feature/*` branches and optional `git worktree add` commands

## Demo 4: Build gate enforcement

Goal: prove `$build` fails closed before prerequisites are satisfied.

On a clean scaffold:

```bash
ma run '$build'
```

Expected:
- build is blocked
- the output reports the missing status prerequisites
- a blocked decision entry is appended to `.ma/decisions.json`

After all gates are green:

```bash
ma run '$build'
```

Expected:
- `build_status = READY`
- suggested branches include `feature/ui` and `feature/api`

## Demo 5: Live GitMCP evidence probe

Goal: prove `$sage` performs a real MCP-backed probe.

Configure at least one real endpoint in `mcp/servers.json`, then run:

```bash
ma run '$sage'
```

Expected:
- live MCP SSE endpoint negotiation
- `initialize`
- `tools/list`
- a repo-specific documentation tool call
- `.ma/evidence/sources.json` records `liveProbe` metadata
- `evidence_status = VERIFIED` when at least one real endpoint succeeds

## Demo 6: Plugin mirror and skills packaging

Goal: prove the published skill surface and plugin mirror stay aligned.

```bash
npm run skills:manifest
npm run plugin:sync
npm run skills:validate
npm run plugin:verify
npm run skills:pack
npm run skills:install -- --path ./dist/installed-skills
```

Expected:
- `skills/index.json` is current
- `plugins/meta-architect/skills/` mirrors `skills/`
- all 7 skills validate
- `dist/meta-architect-skills.tgz` is created
- `dist/installed-skills/` receives:
  - `meta-architect`
  - `arch`
  - `sage`
  - `flow`
  - `vet`
  - `vibe`
  - `build`

## Demo 7: Merge and release policy

Goal: prove branch/release policy enforcement.

```bash
ma merge feature/ui development
ma release development prod
```

Expected:
- `ma merge` only allows `feature/* -> development`
- `ma release` only allows `development` or approved `release/* -> prod`
- final statuses advance through `.ma/release.json`

## Verified repo inventory

| Surface | Current reality |
|---|---|
| Codex launcher | `bin/ma.js` delegates to `codex` |
| Runtime namespace | `.ma/` |
| Public skill directories | 7 |
| Plugin-mirrored skill directories | 7 |
| `.codex` role prompts | 4 prompt files + 6 agent TOMLs |
| MCP config files | 3 |
| Test files | 7 |
| Published npm package target | `@jstn-sdk/meta-architect@0.1.0` |

## Troubleshooting

- If `ma --madmax --high` does not launch Codex, confirm `@openai/codex` is installed globally.
- If `$sage` does not verify evidence, check `mcp/servers.json` and endpoint reachability.
- If `$build` stays locked, run `ma status` and inspect the blocking statuses.
- If plugin verification fails, run `npm run plugin:sync` and re-check the mirror.
