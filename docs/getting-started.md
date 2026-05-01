# Getting Started

This guide takes a new user from clone to a green-gated Meta-Architect workflow on a real project.

## Goal

By the end of this guide you should be able to:
- install Meta-Architect locally
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

## 1. Clone and install

```bash
git clone https://github.com/JustineDevs/meta-architect.git
cd meta-architect
npm install
npm link
```

Why `npm link` matters:
- the docs use the `ma` command directly
- `npm link` makes the local CLI available without requiring a global publish step

## 2. Initialize Meta-Architect

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
- local `.ma/skills/` and `.ma/evidence/` are seeded
- `mcp/`, `docs/`, and `sprint/` surfaces exist
- `ma` launches the local Codex CLI when run with no arguments

Expected output:

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

## 3. Configure MCP / GitMCP

Edit:
- `mcp/servers.json`
- `mcp/collections.json`
- `mcp/fallback.json`

Minimum live example:

```json
{
  "category": "meta-list",
  "repo": "sindresorhus/awesome",
  "endpoint": "https://gitmcp.io/sindresorhus/awesome"
}
```

Recommended first set:
- `sindresorhus/awesome`
- `dzharii/awesome-typescript`
- `sbilly/awesome-security`

See [docs/mcp-setup.md](./mcp-setup.md) for endpoint policy and evidence semantics.

## 4. Capture the project idea

```bash
ma idea "Build a real-time collaborative whiteboard for product teams"
```

Expected effects:
- an idea decision entry is appended to `.ma/decisions.json`
- `idea_status = CLEAR`

If this fails:
- ensure the idea text is not empty
- inspect `.ma/decisions.json` for malformed local data

## 5. Run the skill sequence

### 5.1 Architecture

```bash
ma run '$arch'
```

Expected effects:
- a structured first-pass architecture blueprint is appended
- `architecture_status = APPROVED`

Generated or updated:
- `.ma/decisions.json`
- `.ma/release.json`

### 5.2 Evidence

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

If this fails:
- check endpoint URLs in `mcp/servers.json`
- ensure architecture was approved first
- verify network access
- rerun after correcting the endpoint or environment

### 5.3 Logic

```bash
ma run '$flow'
```

Expected effects:
- a structured first-pass logic/state review is appended
- `logic_status = GREEN` when current prerequisites and transition modeling are acceptable
- `logic_status = RED` when prerequisite gates are not ready

### 5.4 Security

```bash
ma run '$vet'
```

Expected effects:
- `.ma/evidence/audits.json` and `.ma/evidence/cves.json` are updated
- `security_status = GREEN` on a baseline pass
- `security_status = RED` when prerequisite gates are not ready

### 5.5 Experience

```bash
ma run '$vibe'
ma run '$vibe' --waive --reason "Accepted for this release line"
```

Expected effects:
- `.ma/evidence/outcomes.json` is updated
- `experience_status = GREEN` on a baseline pass
- `experience_status = RED` when prerequisite gates are not ready
- `experience_status = WAIVED` when the waiver path is used explicitly

## 6. Inspect gate status

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

## 7. Unlock and run build planning

```bash
ma run '$build'
```

Expected effects:
- build gate is evaluated
- if allowed, `build_status = READY`
- branch suggestions are printed
- worktree commands are suggested

Expected output shape:

```text
Build gate is green.
Suggested branches:
- feature/ui
- feature/api
Optional worktree commands:
git worktree add ../ui feature/ui
git worktree add ../api feature/api
```

If `$build` fails:
- run `ma status`
- read the blocking statuses
- fix the corresponding upstream lane
- rerun that lane, then rerun `$build`

## 8. Example walkthrough: collaborative whiteboard

```bash
ma setup
ma idea "Build a collaborative whiteboard with live cursors and shared boards"
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
- `$arch` records a structured first-pass blueprint
- `$sage` binds major choices to configured GitMCP-backed sources
- `$flow` records the kernel’s baseline state review for the mission
- `$vet` records a baseline security review
- `$vibe` records baseline DX/UX guidance
- `$build` suggests bounded concerns like `feature/ui` and `feature/api`

Related mission:
- [missions/collaborative-whiteboard/mission.md](../missions/collaborative-whiteboard/mission.md)

## 9. Merge and release path

After implementation work is complete:

```bash
ma merge feature/ui development
ma release development prod
```

Expected effects:
- merge only succeeds for `feature/* -> development`
- release only succeeds for `development|release/* -> prod`
- final statuses advance to:
  - `build_status = DONE`
  - `merge_status = MERGED_TO_DEVELOPMENT`
  - `release_status = SHIPPED_TO_PROD`

## 10. Files generated or updated during a normal run

- `.ma/decisions.json`
- `.ma/release.json`
- `.ma/evidence/sources.json`
- `.ma/evidence/audits.json`
- `.ma/evidence/cves.json`
- `.ma/evidence/outcomes.json`

These are local product artifacts created by the runtime. They are not a reason to bypass gate logic manually.

## 11. If a gate fails

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
