# Agent-Compat Integration Report

Date: 2026-08-24

## Verdict

**Needs work before production integration.** The local SDK contract is verified, but the published npm artifact is stale relative to the current TypeScript workspace. The exact requested command `npx jstn-sdk/ma@latest init` is also not a valid npm package invocation; the scoped command `npx @jstn-sdk/ma@latest init` works.

Do not claim all vendor runtimes or all 78 issues are complete. This report separates executable evidence from open issue state.

## Package and Integration

| Check | Result | Evidence |
| --- | --- | --- |
| Local SDK build | PASS | `pnpm build` |
| Local SDK typecheck | PASS | `pnpm typecheck` |
| SDK tests | PASS, 53 tests | `pnpm test` |
| Adapter conformance | PASS, 41/41 | `pnpm verify` |
| Matrix drift | PASS, 41 adapters / 26 vendors | `pnpm matrix:check` |
| Package shape | PASS, 51 files | `pnpm package:check` |
| Package install | PASS | clean temporary npm install |
| Meta consumer wrapper | PASS | `test/agent-compat-integration.test.js` |
| Runtime startup smoke | PASS, 4/4 installed hosts; OpenClaw and Pi explicitly skipped when binaries are absent; Claude Desktop contract validated without CLI startup | `pnpm live-smoke` |
| Published artifact freshness | BLOCKED | npm `0.1.0` points at old `src` files |
| Exact unscoped init command | BLOCKED | npm cannot resolve `jstn-sdk/ma` |

## Current Meta-Architect Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Full repository tests | PASS, 165/165 | `npm test` |
| Disk fixture tests | PASS, 9/9 | `npm run test:disk` |
| Static checks | PASS | `npm run check` (one non-failing Biome schema-version notice) |
| Release metadata | PASS | `npm run release:verify` |
| Fixture cleanup | PASS | `npm run fixtures:cleanup`; no fixture files remain under `/tmp/ma-tests` |
| Disk benchmark | PASS | 100 minimal fixtures: 298-byte maximum, 92 ms total setup |

Disk lifecycle behavior is implemented in [`src/test-fixtures.js`](../src/test-fixtures.js), with CI enforcement in [`ci.yml`](../.github/workflows/ci.yml), scheduled maintenance in [`test-fixture-cleanup.yml`](../.github/workflows/test-fixture-cleanup.yml), and the contract documented in [`disk-optimization.md`](./disk-optimization.md).

## Security Evidence

- Redaction vault retention policy is enforced and the vault file is `0600` on POSIX hosts.
- MCP bridge tests prove argv-only spawning, restricted environment passthrough, bounded timeout, and no test-secret propagation.
- Obsidian tests prove explicit protocol authority, safe paths/tags, attachment limits, overwrite policy, and refused queue retention.
- Security/bridge/Obsidian/redaction suite: 17 passed.
- Runtime state/full-flow suite: 41 passed.
- Latest hardening regression suite: 13 passed, including detached log confinement and Obsidian symlink escape rejection.

## Vendor Evidence

The SDK has **41 registered adapter surfaces across 26 vendor labels**. All 41 pass filesystem conformance. The live harness covers `codex-cli`, `claude-code`, `claude-desktop`, `cursor`, `openclaw`, `hermes`, and `pi`; current local runtime startup evidence is available for `codex-cli`, `claude-code`, `cursor`, and `hermes`. OpenClaw and Pi are reported as skipped when their binaries are not installed, while Claude Desktop is validated at the filesystem contract layer. Other surfaces remain native/portable contract evidence only; cloud, IDE, and SDK adapters require their real host/API environment before runtime claims.

## All Open Issue State

The audit found 78 open GitHub issues. None is silently marked closed by this report. The following IDs remain `open / unverified` unless the evidence above directly covers a narrow behavior; GitHub issue closure still requires its own review and acceptance:

`#119 #116 #115 #114 #113 #112 #111 #110 #107 #106 #105 #104 #103 #102 #101 #100 #99 #98 #97 #96 #95 #94 #93 #92 #91 #90 #89 #88 #87 #86 #85 #84 #83 #82 #81 #80 #79 #78 #77 #76 #75 #74 #73 #72 #71 #70 #69 #68 #67 #66 #65 #64 #63 #62 #61 #60 #59 #58 #57 #56 #55 #54 #53 #52 #51 #50 #49 #48 #47 #46 #45 #44 #43 #41 #40 #39 #38 #37`

Narrow evidence exists for portions of #48, #78, #96, #99, #101, #105, #106, and #107. The remaining issue requirements are not proven by this integration run.

### Issue Triage Matrix

| State | Count | Meaning |
| --- | ---: | --- |
| Fully closed by this report | 0 | No GitHub issue is silently treated as closed. |
| Narrowly evidenced | 8 | Only the specific security or integration behavior named above has executable evidence. |
| Open / unverified | 78 | Acceptance criteria still require implementation, issue-level review, and current evidence. |

The counts intentionally overlap: narrowly evidenced issues remain open until their complete issue acceptance criteria are met.

## Evidence Index

Repository-backed evidence:

- [`test/agent-compat-integration.test.js`](../test/agent-compat-integration.test.js)
- [`test/test-fixtures.test.js`](../test/test-fixtures.test.js)
- [`src/test-fixtures.js`](../src/test-fixtures.js)
- [`docs/disk-optimization.md`](./disk-optimization.md)
- [`package.json`](../package.json) for reproducible verification commands
- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) for CI disk gates

The earlier `/tmp/agent-compat-evidence/*` paths were ephemeral session artifacts and are not treated as durable proof. Re-run the commands in the tables above to regenerate current evidence.

## Release Gate

Before public integration, publish a new SDK patch from `packages/agents`, verify the installed tarball with `pnpm package:check` and a clean consumer install, update the Meta lockfile to that published version, and rerun the integration smoke. Do not publish or push as part of this report.
