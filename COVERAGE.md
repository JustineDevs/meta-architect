# Meta-Architect Feature Coverage Matrix

**Target: Production-ready core orchestration + publishable skills for v0.2.0**  
**Last Updated:** 2026-04-30

## Coverage Summary

| Category | Target Surface | Implemented | Coverage |
|----------|----------------|-------------|----------|
| Core CLI commands | 7 | 7 | 100% |
| Core workflow skills | 6 | 6 | 100% |
| Gate/status contract | 1 | 1 | 100% |
| Live GitMCP probe in `$sage` | 1 | 1 | 100% |
| Build gate enforcement | 1 | 1 | 100% |
| Merge policy enforcement | 1 | 1 | 100% |
| Release policy enforcement | 1 | 1 | 100% |
| Repo-local skill folders | 7 | 7 | 100% |
| Skill packaging pipeline | 4 steps | 4 | 100% |
| Release docs | 6 docs | 6 | 100% |
| Worktree automation | 1 | partial | ~70% |
| Marketplace publishing | 1 | not applicable | 0% |
| **TOTAL** | | | **~94%** |

## Core CLI Commands (7/7 = 100%)

| Command | Status | Purpose |
|---------|--------|---------|
| `ma init` | DONE | Scaffold repo shape and seed baseline files |
| `ma idea` | DONE | Capture project brief and unlock architecture |
| `ma skills` | DONE | List the core skill triggers |
| `ma status` | DONE | Read and display current gate state |
| `ma run $arch|$sage|$flow|$vet|$vibe|$build` | DONE | Execute the core orchestration workflow |
| `ma merge` | DONE | Enforce `feature/* -> development` |
| `ma release` | DONE | Enforce `development|release/* -> prod` |

## Core Workflow Skills (6/6 = 100%)

| Skill | Trigger | Status | Mechanism |
|-------|---------|--------|-----------|
| Architect | `$arch` | DONE | `src/skills.js` + `.meta-architect/skills/arch.skill.md` |
| OSS Sage | `$sage` | DONE | live GitMCP SSE/JSON-RPC probe + `.meta-architect/skills/sage.skill.md` |
| Logic Specialist | `$flow` | DONE | `src/skills.js` + `.meta-architect/skills/flow.skill.md` |
| Security Auditor | `$vet` | DONE | `src/skills.js` + `.meta-architect/skills/vet.skill.md` |
| DX/UX Specialist | `$vibe` | DONE | `src/skills.js` + `.meta-architect/skills/vibe.skill.md` |
| Builder | `$build` | DONE | `src/build-gate.js` + `.meta-architect/skills/build.skill.md` |

## Status & Gate Contract

| Field | Values | Enforced |
|-------|--------|----------|
| `idea_status` | `DRAFT`, `CLEAR`, `BLOCKED` | YES |
| `architecture_status` | `DRAFT`, `REVIEWED`, `APPROVED` | YES |
| `evidence_status` | `MISSING`, `PARTIAL`, `VERIFIED` | YES |
| `logic_status` | `PENDING`, `GREEN`, `RED` | YES |
| `security_status` | `PENDING`, `GREEN`, `RED` | YES |
| `experience_status` | `PENDING`, `GREEN`, `RED`, `WAIVED` | YES |
| `build_status` | `LOCKED`, `READY`, `RUNNING`, `DONE` | YES |
| `merge_status` | `LOCKED`, `READY`, `MERGED_TO_DEVELOPMENT` | YES |
| `release_status` | `LOCKED`, `READY`, `SHIPPED_TO_PROD` | YES |

### Build Lock Coverage

`$build` is blocked unless all are true:
- `idea_status = CLEAR`
- `architecture_status = APPROVED`
- `evidence_status = VERIFIED`
- `logic_status = GREEN`
- `security_status = GREEN`
- `experience_status ∈ { GREEN, WAIVED }`
- `build_status ∈ { LOCKED, READY }`

## GitMCP / MCP Coverage

| Capability | Status | Notes |
|------------|--------|-------|
| Endpoint validation | DONE | exact `gitmcp.io/{owner}/{repo}` and `gitmcp.io/docs` patterns |
| Live SSE endpoint negotiation | DONE | implemented in `src/mcp-live-client.js` |
| MCP `initialize` | DONE | real JSON-RPC init against GitMCP |
| MCP `tools/list` | DONE | real tool discovery |
| MCP repo-specific tool call | DONE | `$sage` calls repo-specific documentation tool |
| Multi-endpoint full live probing | PARTIAL | runtime intentionally proves at least one real endpoint per run |

## Skills Publishing Coverage

| Capability | Status | Mechanism |
|------------|--------|-----------|
| Repo-local installable skill folders | DONE | `skills/*` |
| Skill UI metadata | DONE | `skills/*/agents/openai.yaml` |
| Skill manifest generation | DONE | `npm run skills:manifest` |
| Skill validation | DONE | `npm run skills:validate` |
| Skill tarball packaging | DONE | `npm run skills:pack` |
| Skill install smoke test | DONE | `npm run skills:install -- --path ...` |

## Release Surface Coverage

| Surface | Status | Mechanism |
|---------|--------|-----------|
| Source release commit/tag flow | DONE | local git release flow |
| GitHub release asset upload | DONE | uploaded `dist/meta-architect-skills.tgz` |
| NPM org publish | BLOCKED by metadata/policy | not published |
| Marketplace publish | NOT APPLICABLE | no marketplace package exists |

## Validation Coverage

| Check | Status |
|------|--------|
| `npm test` | PASS |
| `npm run check` | PASS |
| CLI smoke tests | PASS |
| Full isolated flow test | PASS |
| Live GitMCP proof | PASS |
| Merge/release isolated proof | PASS |
| Skills validate | PASS |
| Skills pack/install proof | PASS |

## Known Gaps

1. **Worktree lifecycle is still operator-driven**  
   Meta-Architect suggests worktree commands but does not automate add/remove/prune.

2. **NPM publish contract is not finalized**  
   The repo still needs an explicitly approved `@jstn-sdk/<name>` package identity and public npm metadata before publish.

3. **Marketplace distribution is not part of this repo**  
   There is no real extension/gallery package manifest or publisher config.

## Production Interpretation

Meta-Architect currently covers the production `v0.2.0` core bar for:
- reliable core orchestration,
- stable status/branch contract,
- publishable repo-local skill artifacts,
- and documented verification evidence.

It does **not** yet cover:
- automatic worktree lifecycle,
- confirmed npm public package publication,
- or marketplace publication.
