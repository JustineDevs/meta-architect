# Meta-Architect Demo Guide

## Prerequisites

- Node.js >= 20
- Git >= 2.30 with `git worktree` support
- An MCP-capable LLM CLI installed and authenticated
- Network access to GitMCP for live `$sage` verification

## Setup (< 2 minutes)

```bash
# Clone and install
git clone https://github.com/JustineDevs/meta-architect.git
cd meta-architect
npm install

# Initialize Meta-Architect in this repo
ma init
```

**Expected output:**
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

## Verify Installation

```bash
ma skills
ma status
```

**Expected output for `ma skills`:**
```text
$arch
$sage
$flow
$vet
$vibe
$build
```

**Expected output for `ma status` on a clean baseline:**
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

## Demo 1: Full Skill Pipeline

```bash
ma idea "Build a real-time collaborative whiteboard for remote product teams"
ma run $arch
ma run $sage
ma run $flow
ma run $vet
ma run $vibe
ma status
ma run $build
```

**Expected:**
- `ma idea` records the project brief and sets `idea_status = CLEAR`
- `$arch` approves the architecture
- `$sage` verifies evidence from configured GitMCP sources
- `$flow`, `$vet`, and `$vibe` move their gates to green
- `ma status` shows `$build` as the next allowed trigger
- `$build` proposes `feature/*` branches and optional `git worktree add` commands

## Demo 2: Live GitMCP Evidence Probe

Configure at least one real GitMCP endpoint in `mcp/servers.json`, then run:

```bash
ma run $sage
```

**Expected:**
- The command opens a live MCP SSE session to a configured GitMCP endpoint
- It performs `tools/list`
- It performs a repo-specific documentation tool call
- `.omx/evidence/sources.json` records `liveProbe` metadata
- `evidence_status` becomes `VERIFIED` if at least one real endpoint succeeds

## Demo 3: Build Gate Enforcement

On a clean repo, run:

```bash
ma run $build
```

**Expected:**
- Build is blocked
- A decision entry is appended to `.omx/decisions.json`
- The output identifies which gate is blocking

After all gates are green, rerun:

```bash
ma run $build
```

**Expected:**
- `build_status = READY`
- Suggested branches include:
  - `feature/ui`
  - `feature/api`
- Optional worktree commands are printed

## Demo 4: Merge and Release Policy

Once build is ready:

```bash
ma merge feature/ui development
ma release development prod
```

**Expected:**
- `ma merge` allows only `feature/* -> development`
- `ma release` allows only `development` or approved `release/* -> prod`
- Final statuses advance to:
  - `build_status = DONE`
  - `merge_status = MERGED_TO_DEVELOPMENT`
  - `release_status = SHIPPED_TO_PROD`

## Demo 5: Skills Packaging

```bash
npm run skills:manifest
npm run skills:validate
npm run skills:pack
npm run skills:install -- --path ./dist/installed-skills
```

**Expected:**
- `skills/index.json` is generated
- All 7 repo-local skill folders validate
- `dist/meta-architect-skills.tgz` is created and non-empty
- `dist/installed-skills/` receives all 7 installable skills

## File Inventory

| Component | Count | Location |
|-----------|-------|----------|
| Codex agent definitions | 6 | `.codex/agents/*.toml` |
| OMX skill contract files | 7 | `.omx/skills/*.skill.md` |
| Repo-local published skills | 7 | `skills/*/SKILL.md` |
| CLI source files | 8 | `src/*.js`, `bin/ma.js` |
| MCP config files | 3 | `mcp/*.json` |
| Test files | 6 | `test/*.test.js` |

## Troubleshooting

- **`$sage` is not verifying evidence:** Confirm at least one real GitMCP endpoint is reachable and listed in `mcp/servers.json`.
- **`$build` stays locked:** Run `ma status` and inspect the blocking statuses.
- **Merge or release is rejected:** Check branch names against the documented policy in `docs/release-spec.md`.
- **Skill packaging fails:** Re-run `npm run skills:validate` and inspect the generated `skills/index.json`.
