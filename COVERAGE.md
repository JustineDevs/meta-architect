# Meta-Architect Coverage Matrix

Target release: `v0.1.0`  
Last verified: 2026-05-02  
Published npm package: `@jstn-sdk/meta-architect@0.1.0` (`latest`, published 2026-05-01T16:05:21Z)

## Coverage summary

| Category | Current state | Evidence |
|---|---|---|
| Canonical install/launch contract | DONE | `README.md`, `RELEASE.md`, package-install smoke |
| `ma` launcher into Codex | DONE | `test/cli-smoke.test.js`, `test/package-install-smoke.test.js` |
| Core skill surface | DONE | `skills/`, `skills/index.json`, `skills:validate` |
| Repo-local helper path | DONE | `test/full-flow.test.js`, `test/cli-smoke.test.js` |
| Build gate enforcement | DONE | `src/build-gate.js`, `test/build-gate.test.js`, `test/cli-smoke.test.js` |
| Merge/release policy enforcement | DONE | `src/policy.js`, `test/policy.test.js` |
| Live GitMCP probe support | DONE | `src/mcp-live-client.js`, `src/skills.js`, `test/mcp-config.test.js` |
| Plugin mirror discipline | DONE | `scripts/plugin-sync.js`, `plugin:verify`, package dry-run |
| Plugin metadata / marketplace discovery | DONE | `.agents/plugins/marketplace.json`, `plugins/meta-architect/.codex-plugin/plugin.json` |
| Package dry-run | DONE | `npm run pack:inspect` |
| Release check pipeline | DONE | `npm run release:check` |

## Runtime and workflow coverage

| Surface | Status | Notes |
|---|---|---|
| `ma setup` scaffolding | DONE | seeds `.ma`, `.codex`, docs, sprint, and MCP baseline files |
| `ma idea` | DONE | records a project brief and clears the idea gate |
| `ma skills` | DONE | lists the 6 runtime triggers |
| `ma status` | DONE | reports release-state and next allowed triggers |
| `ma run '$arch'` | DONE | architecture gate |
| `ma run '$sage'` | DONE | evidence gate with live MCP support |
| `ma run '$flow'` | DONE | logic gate |
| `ma run '$vet'` | DONE | security gate |
| `ma run '$vibe'` | DONE | DX/UX gate |
| `ma run '$build'` | DONE | build-readiness gate |
| `ma merge` | DONE | branch policy enforcement |
| `ma release` | DONE | release policy enforcement |

## Skill surface coverage

Canonical public skills:
- `meta-architect`
- `arch`
- `sage`
- `flow`
- `vet`
- `vibe`
- `build`

Coverage state:
- source skill contracts in `skills/`: DONE
- generated manifest in `skills/index.json`: DONE
- plugin-mirrored skill contracts in `plugins/meta-architect/skills/`: DONE
- installable package skill surface via `postinstall`: DONE

## Test coverage actually present

| Test file | What it proves |
|---|---|
| `test/build-gate.test.js` | build gate evaluation helpers |
| `test/cli-smoke.test.js` | scaffold creation, build lock, launcher delegation, exit-code propagation |
| `test/full-flow.test.js` | full helper workflow reaches build-ready state |
| `test/mcp-config.test.js` | MCP endpoint validation behavior |
| `test/package-install-smoke.test.js` | packed npm install, postinstall skill installation, launcher behavior, helper flow |
| `test/policy.test.js` | merge/release branch policy enforcement |
| `test/release-state.test.js` | release-state persistence and validation |

Current automated verification count:
- 7 test files
- 7/7 passing on the latest verification run

## Packaging and plugin coverage

| Surface | Status | Mechanism |
|---|---|---|
| npm package identity | DONE | `@jstn-sdk/meta-architect@0.1.0` |
| public scoped package config | DONE | `publishConfig.access = public` |
| package files whitelist | DONE | `package.json > files` |
| skill bundle tarball | DONE | `npm run skills:pack` |
| package dry-run | DONE | `npm run pack:inspect` |
| plugin mirror sync | DONE | `npm run plugin:sync` |
| plugin mirror verification | DONE | `npm run plugin:verify` |
| plugin manifest | DONE | `plugins/meta-architect/.codex-plugin/plugin.json` |
| local marketplace metadata | DONE | `.agents/plugins/marketplace.json` |

## Release and docs coverage

| Surface | Status | Notes |
|---|---|---|
| `README.md` canonical install block | DONE | scoped package + `ma --madmax --high` |
| onboarding / quickstart docs | DONE | same canonical story |
| release spec | DONE | `v0.1.0` aligned |
| release readiness doc | DONE | includes live npm publish state |
| release summary doc | DONE | includes live npm publish state |
| CI / PR workflows | DONE | skills manifest + plugin mirror enforced |

## Known limits

These are limits, not stale gaps:

1. Live `$sage` verification still depends on reachable GitMCP endpoints.
2. Worktree commands are suggested, not fully lifecycle-managed.
3. npm publication is already real for `0.1.0`; a future version bump will require the same release-doc sync discipline.

## Current truth statement

Meta-Architect currently covers the `v0.1.0` release bar for:
- canonical install and launch
- Codex-hosted runtime entry
- skills-first orchestration
- repo-local helper flow
- skill packaging and plugin mirroring
- release/policy enforcement
- release-ready verification

It is not a placeholder demo repository and these files should be read as verified operational documentation, not aspirational planning notes.
