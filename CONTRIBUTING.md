# Contributing to Meta-Architect

Meta-Architect is a production-focused orchestration layer for verified engineering workflows.
This repository treats orchestration, memory, evidence, learning, security, DX/UX review, package hygiene, and release readiness as first-class contracts.
Contributions should improve those contracts rather than bypass them.

## Principles

All contributions should follow these rules:

- Do not weaken gate enforcement.
- Do not add undocumented behavior to core skills.
- Do not introduce release automation that hides failures.
- Do not convert semantic context into build evidence without the owning lane.
- Do not commit runtime `.ma` state such as logs, state snapshots, or local caches.
- Prefer explicit, inspectable files over hidden magic.
- Keep public skill contracts stable unless the change is intentionally versioned.

## Repository map

High-level repository surfaces:

- `.codex/agents/` — role agent configs
- `.codex/hooks.json` — pre/post execution rules
- `.ma/` — local runtime state seeded by `ma setup`; production packages must not ship local `.ma` state
- `skills/` — publishable/installable skill surfaces
- `prompts/` — stable role prompt contracts
- `templates/` — generated/shared repo templates
- `mcp/` — GitMCP/MCP server and collection mappings
- `plugins/meta-architect/` — plugin-installable bundle surface
- `data/` — production proof artifacts such as clone-data proof, ledger, and RVF files
- `.github/workflows/` — CI and release automation
- `docs/` — user, contributor, and release documentation
- `DEMO.md` — package-visible production demo guide
- `COVERAGE.md` — canonical current coverage matrix

## Local setup

### Prerequisites

- Node.js 20+
- npm 10+
- Git
- GitHub CLI (`gh`) for release operations
- Optional: `git-filter-repo` for history cleanup work
- Optional: MCP-capable local environment for end-to-end demos

### Install

```bash
npm install
```

### Validate the repo

Run the release-critical checks:

```bash
npm run release:verify
npm run skills:manifest
npm run skills:validate
npm run skills:pack
npm run plugin:sync
npm run plugin:verify
npm run check
npm test
npm run pack:inspect
```

## Contribution types

Typical contribution categories:

- Skill contract changes
- Prompt refinements
- MCP mapping improvements
- Obsidian/context integrations
- Learning-loop and workspace intelligence improvements
- Package hygiene and proof artifact updates
- Release automation fixes
- Documentation improvements
- CI and packaging hardening

## Working on skills

When changing any skill in `skills/` or `plugins/meta-architect/skills/`:

1. Update the skill content.
2. Update docs if the contract changed.
3. Regenerate the skills manifest if needed:
   ```bash
   npm run skills:manifest
   ```
4. Validate all skills:
   ```bash
   npm run skills:validate
   ```
5. Repack and smoke-test install:
   ```bash
   npm run skills:pack
   npm run plugin:sync
   npm run plugin:verify
   ```

### Skill contract expectations

Each publishable skill should clearly define:

- purpose
- expected trigger/use
- required inputs
- expected outputs
- gating or status implications
- any safety constraints

Do not introduce vague or hidden side effects.

## Working on prompts

Prompt files under `prompts/` should remain stable role contracts.

A prompt should answer:

- who the role is
- what it is responsible for
- what it must produce
- what it must not do

Do not turn prompts into ad-hoc implementation dumps unless that detail is part of the public role contract.

## Working on MCP mappings

Files under `mcp/` should stay explicit and inspectable.

When editing collections or server mappings:

- use real GitMCP/MCP endpoints
- document any new collection categories
- avoid placeholder URLs in committed production configs
- update `docs/mcp-setup.md` if the setup flow changes
- keep discovery accelerators separate from verified evidence claims

## Working on semantic cores

Semantic runtime cores are first-party contracts, not one-off helper files.

Relevant surfaces include:

- `src/runtime/semantic-recording-core.js`
- `src/runtime/workspace-intelligence-runtime.js`
- `src/runtime/learning-loop-core.js`
- `src/runtime/obsidian-integration-core.js`
- `src/runtime/obsidian-plugin-bridge.js`
- `src/runtime/context-economy-core.js`
- `src/runtime/prompt-strategy-core.js`
- `src/runtime/ralph-execution-core.js`
- `src/runtime/redaction-gateway.js`

When changing these surfaces:

- add or update focused tests under `test/`
- ensure `ma setup` seeds any new runtime artifact
- update `src/runtime/runtime-state.js` when the artifact must appear in snapshots or repair
- export public APIs through `index.js` when package consumers need them
- update `COVERAGE.md`, `DEMO.md`, and `README.md` if behavior or proof surfaces changed
- preserve semantic boundaries: brain context, technical evidence, execution progress, verification confidence, and release authority are separate channels

## Runtime `.ma` rule

These should **not** be committed:

- `.ma/logs/`
- `.ma/state/`
- `.ma/tmp/`
- `.ma/cache/`
- generated local-only runtime residue

These may be committed if they are part of the intended product contract:

- `.ma/skills/`
- `.ma/evidence/`
- `.ma/decisions.json`
- `.ma/release.json`

If uncertain, ask before committing new `.ma` paths.

## Branching and commits

Repository branch strategy:

- `main` = release-facing protected branch
- `dev` = normal integration branch
- `feature/*` = short-lived contribution branches

Default contributor workflow:

- branch from `dev`
- open focused PRs targeting `dev`
- avoid unrelated formatting churn
- keep release changes separate from feature changes when possible
- do not open ordinary feature PRs directly to `main`

Curated promotion workflow:

- promote `dev` into `main` through a release-facing PR
- treat direct `main` work as maintainer-only exception handling
- do not bypass `main` protections except for genuine emergency or admin recovery cases

Preferred commit styles:

- `feat: add <capability>`
- `fix: correct <behavior>`
- `docs: update <surface>`
- `ci: harden <workflow>`
- `chore: maintain <repo surface>`
- `chore(release): prepare v0.1.13`

## Pull requests

Every PR should include:

- what changed
- why it changed
- what files/surfaces were affected
- how it was tested
- whether docs were updated
- whether release behavior changed

If a PR changes skills, release automation, package metadata, or `.github/workflows`, it should be treated as release-sensitive.

### Base branch policy

- Normal contribution PRs must target `dev`.
- `main` is reserved for curated promotion PRs, normally `dev -> main`.
- If you open a PR to `main`, explain why it is a release-facing exception.

## Release-sensitive changes

These require extra care:

- `package.json`
- `package-lock.json`
- `.npmignore`
- `skills/index.json`
- `scripts/skills-*`
- `scripts/release-verify.js`
- `.github/workflows/*`
- `.github/scripts/*`
- `plugins/meta-architect/*`
- release docs (`RELEASE.md`, `COVERAGE.md`, `DEMO.md`, `docs/qa/*`)

For these changes, include a clear test summary in the PR.

## Documentation expectations

If you change behavior, update the docs in the same PR when applicable:

- `README.md`
- `docs/getting-started.md`
- `docs/skills.md`
- `docs/mcp-setup.md`
- `docs/skills-publishing.md`
- `RELEASE.md`
- `COVERAGE.md`
- `DEMO.md`

## Before opening a PR

Run at least:

```bash
npm run release:verify
npm run skills:manifest
npm run skills:validate
npm run skills:pack
npm run plugin:sync
npm run plugin:verify
npm run check
npm test
npm run pack:inspect
```

And verify:

- no forbidden `.ma` runtime files are staged
- no accidental tarballs or temp outputs are committed
- docs are consistent with behavior
- release notes are updated if needed
- package dry-run does not include runtime state, tests, local caches, or generated distro artifacts

## PR checklist

- [ ] My change is focused and intentional.
- [ ] I did not commit runtime `.ma` state.
- [ ] I updated relevant docs.
- [ ] I ran the skill packaging/validation flow.
- [ ] I included notes for any release-sensitive change.
- [ ] I did not weaken gate enforcement or hide failures.

## Release rule

Meta-Architect is production-oriented. If a change makes the repository less inspectable, less reproducible, or less strict about gates and evidence, it should not be merged until that regression is corrected.
