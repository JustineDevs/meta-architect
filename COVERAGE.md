# Meta-Architect Coverage Matrix

Target release: `v0.14.0`
Last verified: 2026-06-03
Package: `@jstn-sdk/ma@0.14.0`

This file is the canonical operator-facing coverage map for the current release line.
It records what MA can prove today through repository tests, runtime artifacts, package dry-runs, and release gates.

> [!IMPORTANT]
> Coverage entries are production claims only when they point to concrete files, commands, or seeded runtime artifacts.
> Candidate learnings and vault context may inform planning, but they do not become build evidence without owning-lane promotion.

## Coverage summary

| Category | Current state | Evidence |
| --- | --- | --- |
| Canonical install/launch contract | DONE | `README.md`, `DEMO.md`, `scripts/install.sh`, `scripts/release-verify.js` |
| `ma` launcher into Codex | DONE | `bin/ma.js`, `test/cli-smoke.test.js`, `test/package-install-smoke.test.js` |
| `$maestro` orchestration | DONE | `src/runtime/maestro-manager.js`, `src/runtime/maestro-state.js`, `test/runtime-state.test.js` |
| Core skill surface | DONE | `skills/`, `skills/index.json`, `npm run skills:validate` |
| Helper skill surface | DONE | `$align`, `$diagnose`, `$tdd`, `$cleanup` contracts in `skills/`, plugin mirror, and Helper Orchestration Core |
| Build gate enforcement | DONE | `src/build-gate.js`, `test/build-gate.test.js`, `test/cli-smoke.test.js` |
| Release issue gates | DONE | `src/release-issue-gates.js`, `docs/qa/release-issue-gates-0.14.0.json`, `test/release-issue-gates.test.js` |
| Live GitMCP probe support | DONE | `src/mcp-live-client.js`, `src/skills.js`, `test/mcp-config.test.js` |
| MCP policy and exposure control | DONE | `src/runtime/mcp-policy.js`, `src/runtime/exposure-catalog.js`, `test/mcp-policy.test.js`, `test/exposure-catalog.test.js` |
| Plugin mirror discipline | DONE | `scripts/plugin-sync.js`, `npm run plugin:verify`, package dry-run |
| Package dry-run | DONE | `npm run pack:inspect` |
| Release check pipeline | DONE | `npm run release:check` |

## Runtime and workflow coverage

| Surface | Status | Notes |
| --- | --- | --- |
| `ma setup` scaffolding | DONE | seeds `.ma`, `.codex`, docs, sprint, MCP baseline files, and semantic runtime cores |
| `ma bootstrap` | DONE | repairs packaged assets, support bundle, local runtime files, and optional starter MCP files |
| `ma doctor` | DONE | reports check-only readiness without mutating local state |
| `ma idea` | DONE | records a project brief and clears the idea gate |
| `ma skills` | DONE | lists the 11 public runtime triggers |
| `ma status --maestro-view` | DONE | reports release state, manager state, and next allowed actions |
| `ma run '$maestro'` | DONE | bounded autonomous manager; coordinates without bypassing lane authority |
| `ma run '$arch'` | DONE | architecture gate and spec artifacts |
| `ma run '$sage'` | DONE | evidence gate with live MCP support and fallback classification |
| `ma run '$flow'` | DONE | logic gate and transition review |
| `ma run '$vet'` | DONE | security/compliance gate and package exposure intake |
| `ma run '$vibe'` | DONE | DX/UX gate and outcome recording |
| `ma run '$build'` | DONE | build-readiness gate with fail-closed prerequisites |
| `ma merge` | DONE | branch policy enforcement |
| `ma release` | DONE | release policy enforcement |

## Semantic core coverage

| Core | Status | Seeded artifact | Test evidence |
| --- | --- | --- | --- |
| Semantic Recording Core | DONE | `.ma/context/recording-core.json` | `test/runtime-state.test.js` |
| Helper Orchestration Core | DONE | `.ma/context/helper-orchestration-core.json` | `test/helper-orchestration-core.test.js`, `test/full-flow.test.js` |
| Environment Awareness Core | DONE | `.ma/context/environment-awareness-core.json` | `test/environment-awareness-core.test.js`, `test/runtime-state.test.js` |
| Universal Plugin Broker Core | DONE | `.ma/context/universal-plugin-broker-core.json` | `test/universal-plugin-broker-core.test.js`, `test/runtime-state.test.js` |
| Workspace Intelligence Runtime | DONE | `.ma/context/workspace-context-pack.json`, `.ma/context/workspace-effectiveness.json` | `test/workspace-intelligence-runtime.test.js` |
| Learning Loop Core | DONE | `.ma/context/learning-loop-core.json` | `test/learning-loop-core.test.js` |
| Active Autonomy Core | DONE | `.ma/context/active-autonomy-core.json` | `test/active-autonomy-contract.test.js` |
| Context Economy Core | DONE | `.ma/context/context-economy-core.json` | `test/context-economy-core.test.js` |
| Prompt Strategy Core | DONE | `.ma/context/prompt-strategy-core.json` | `test/prompt-strategy-core.test.js` |
| Obsidian Integration Core | DONE | `.ma/context/obsidian-bridge.json`, `.ma/context/obsidian-vault-index.json` | `test/obsidian-integration-core.test.js` |
| Obsidian Plugin Bridge | DONE | `plugins/meta-architect/obsidian/` | `test/obsidian-plugin-bridge.test.js` |
| Ralph Execution Core | DONE | `scripts/ralph/prompt.md`, `.ma/plans/`, story contracts | `test/ralph-execution-core.test.js` |
| Redaction Gateway | DONE | provider-bound redaction receipts | `test/redaction-gateway.test.js` |
| Quorum Review Engine | DONE | review/confidence receipts | `test/quorum-review.test.js` |
| Workspace Virtualizer | DONE | `.ma/context/workspace-virtualizer.json` | `test/workspace-virtualizer.test.js` |
| Code Graph Rehearse | DONE | `.ma/context/code-graph-rehearse.json` | `test/code-graph-rehearse.test.js` |
| Skills Registry Export | DONE | `.ma/context/skills-registry-export.json` | `test/skills-registry-export.test.js` |

## Learning-loop reliability domains

| Domain | Current coverage |
| --- | --- |
| Core & Orchestration | manager runs, lane handoffs, autonomy rules, and runtime-state repair |
| Memory & Knowledge | `.ma/memory/notes.md`, semantic receipts, Obsidian vault context, project context |
| Intelligence & Learning | prompt strategy, context economy, learning-loop records, workspace effectiveness checks |
| Code Quality & Testing | sequential `node --test`, Biome checks, package install smoke, release check |
| Security & Compliance | `$vet`, exposure catalog, MCP policy, redaction gateway, security playbooks |
| Architecture & Methodology | `$arch`, decisions, architecture spec, native engineering patterns |
| DevOps & Observability | hooks, audit logs, release sync, Linux package smoke, package dry-run |
| Extensibility | skills, plugin mirror, MCP config, cross-agent skill export, Obsidian plugin |
| Domain-Specific | MA release-hardening scenario, clone-data proof artifacts, trusted GitMCP source mapping |

## Skill surface coverage

Canonical public skills:

- `maestro`
- `arch`
- `sage`
- `flow`
- `vet`
- `vibe`
- `build`
- `align`
- `diagnose`
- `tdd`
- `cleanup`

Coverage state:

- source skill contracts in `skills/`: DONE
- generated manifest in `skills/index.json`: DONE
- plugin-mirrored skill contracts in `plugins/meta-architect/skills/`: DONE
- installable package skill surface via `postinstall`: DONE

## Test coverage actually present

| Test file | What it proves |
| --- | --- |
| `test/active-autonomy-contract.test.js` | anti-passive behavior contract and prompt surfaces |
| `test/alignment-sentinel.test.js` | runtime drift detection and bounded recovery recommendations |
| `test/build-gate.test.js` | build gate evaluation helpers |
| `test/cli-smoke.test.js` | scaffold creation, build lock, launcher delegation, exit-code propagation |
| `test/clone-data-artifacts.test.js` | production clone-data proof, ledger, RVF, and package visibility |
| `test/code-graph-rehearse.test.js` | non-mutating code graph rehearsal and touchpoint extraction |
| `test/context-economy-core.test.js` | context budget rules and exact-preserve safety boundaries |
| `test/core-source-ingest.test.js` | local core-source ingest contracts |
| `test/exposure-catalog.test.js` | package exposure and dependency-risk finding generation |
| `test/environment-awareness-core.test.js` | existing skill, MCP, plugin, and opt-in global capability discovery with path redaction and non-evidence boundaries |
| `test/full-flow.test.js` | full helper workflow reaches build-ready state |
| `test/helper-orchestration-core.test.js` | `$align`, `$diagnose`, `$tdd`, `$cleanup` route composition, receipts, and non-gating boundaries |
| `test/learning-loop-core.test.js` | nine-domain learning loop and fail-closed learning records |
| `test/linux-package-artifacts.test.js` | Linux package artifact naming |
| `test/mcp-config.test.js` | MCP endpoint validation and live-bridge behavior |
| `test/mcp-policy.test.js` | runtime MCP policy validation |
| `test/obsidian-integration-core.test.js` | vault-context indexing and graph-link behavior |
| `test/obsidian-plugin-bridge.test.js` | in-app plugin bridge, metadata, queue, frontmatter, attachments, protocol helpers |
| `test/package-exports.test.js` | public package API exports core runtime capabilities |
| `test/package-install-smoke.test.js` | packed npm install, postinstall skill installation, launcher behavior, helper flow |
| `test/policy.test.js` | merge/release branch policy enforcement |
| `test/prompt-strategy-core.test.js` | prompt strategy policy and high-risk preservation |
| `test/quorum-review.test.js` | review vote confidence and minority reports |
| `test/ralph-execution-core.test.js` | PRD/story execution contract and progress loop |
| `test/redaction-gateway.test.js` | provider-bound context redaction |
| `test/release-issue-gates.test.js` | issue gate schema and production-pass requirements |
| `test/release-state.test.js` | release-state persistence and validation |
| `test/release-sync.test.js` | release metadata synchronization |
| `test/runtime-state.test.js` | runtime snapshot, repair, seeded artifacts, manager state, Obsidian, learning-loop integration |
| `test/skills-registry-export.test.js` | multi-agent skill export and compatibility matrix |
| `test/universal-plugin-broker-core.test.js` | hybrid plugin broker manifest validation, local bundle isolation, MCP wrapper generation, vendor config injection, idempotency, and MA context skill export |
| `test/workspace-intelligence-runtime.test.js` | capability composition, semantic receipts, workspace effectiveness |
| `test/workspace-virtualizer.test.js` | bounded verification sandbox receipts |

Current automated verification count:

- 36 test files executed by `npm test`
- 36/36 passing on the latest full release verification run

## Packaging and plugin coverage

| Surface | Status | Mechanism |
| --- | --- | --- |
| npm package identity | DONE | `@jstn-sdk/ma@0.14.0` |
| public scoped package config | DONE | `publishConfig.access = public` |
| package files allowlist | DONE | `package.json > files` |
| production ignore policy | DONE | `.npmignore` plus `npm pack --dry-run` |
| production data artifacts | DONE | `data/clone-data.proof.json`, `data/clone-data.ledger.json`, `data/clone-data.rvf` |
| demo guide package visibility | DONE | `DEMO.md` included in dry-run package output |
| skill bundle tarball | DONE | `npm run skills:pack` |
| package dry-run | DONE | `npm run pack:inspect` |
| plugin mirror sync | DONE | `npm run plugin:sync` |
| plugin mirror verification | DONE | `npm run plugin:verify` |
| plugin manifest | DONE | `plugins/meta-architect/.codex-plugin/plugin.json` |
| local marketplace metadata | DONE | `.agents/plugins/marketplace.json` |

## Release and docs coverage

| Surface | Status | Notes |
| --- | --- | --- |
| `README.md` canonical install block | DONE | jsDelivr installer, npm fallback, `ma --madmax --high`, uninstall commands |
| `DEMO.md` production demo | DONE | real MA release-hardening scenario and end-to-end smoke commands |
| `docs/getting-started.md` onboarding | DONE | source checkout, helper path, gates, runtime artifacts |
| `docs/skills.md` skill reference | DONE | trigger-by-trigger contract guide |
| `docs/mcp-setup.md` evidence policy | DONE | GitMCP endpoint semantics and bridge guidance |
| `docs/release-spec.md` release policy | DONE | `v0.14.0` aligned |
| `docs/qa/release-readiness-0.14.0.md` | DONE | current QA evidence |
| `scripts/release-verify.js` | DONE | checks install docs, demo doc, issue gates, package metadata, `.npmignore` |

## Known limits

These are explicit operating limits, not stale gaps:

1. Live `$sage` verification depends on reachable GitMCP endpoints or a trusted local bridge.
2. Obsidian context records as `vault_context`; it does not become `build_evidence` without owning-lane promotion.
3. Candidate learning records can inform context, but cannot mutate release state or durable policy.
4. Linux native package build/smoke checks require a Linux environment for full distro-package validation.
5. A local shell publish cannot generate npm provenance; provenance requires a supported CI/CD provider.

## Current truth statement

Meta-Architect currently covers the `v0.14.0` release bar for:

- canonical install and launch
- Codex-hosted runtime entry
- `$maestro` bounded orchestration
- gated architecture/evidence/logic/security/DX/build workflow
- helper skills backed by Helper Orchestration Core receipts that do not mutate release gates
- existing workspace skill, MCP, and plugin discovery through Environment Awareness Core without auto-running or promoting capabilities to build evidence
- universal plugin brokering through MCP vendor injection plus `.agents/skills` context payloads across supported agents
- Obsidian as semantic brain context
- learning-loop reliability across nine domains
- Ralph-style story execution after gates
- context economy and prompt strategy cores
- plugin mirroring, MCP policy, skill packaging, package proof, and release verification

This repository is not a toy demo.
Coverage claims above are tied to concrete files, commands, tests, or package dry-run evidence.
