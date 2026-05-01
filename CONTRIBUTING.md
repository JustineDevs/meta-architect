# Contributing to Meta-Architect

Thanks for contributing to Meta-Architect.

Meta-Architect is a production-focused orchestration layer for verified engineering workflows. This repository treats architecture, evidence, security, DX/UX review, and release readiness as first-class contracts. Contributions should preserve those contracts rather than bypass them.

## Principles

All contributions should follow these rules:

- Do not weaken gate enforcement.
- Do not add undocumented behavior to core skills.
- Do not introduce release automation that hides failures.
- Do not commit runtime `.omx` state such as logs, state snapshots, or local caches.
- Prefer explicit, inspectable files over hidden magic.
- Keep public skill contracts stable unless the change is intentionally versioned.

## Repository map

High-level repository surfaces:

- `.codex/agents/` — role agent configs
- `.codex/hooks.json` — pre/post execution rules
- `.omx/skills/` — internal skill logic
- `skills/` — publishable/installable skill surfaces
- `prompts/` — stable role prompt contracts
- `templates/` — generated/shared repo templates
- `mcp/` — GitMCP/MCP server and collection mappings
- `plugins/meta-architect/` — plugin-installable bundle surface
- `missions/` — reproducible demo/evaluation missions
- `.github/workflows/` — CI and release automation
- `docs/` — user, contributor, and release documentation

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
npm run skills:manifest
npm run skills:validate
npm run skills:pack
npm run skills:install -- --path ./dist/installed-skills
npm run check
npm test
```

## Contribution types

Typical contribution categories:

- Skill contract changes
- Prompt refinements
- MCP mapping improvements
- Release automation fixes
- Documentation improvements
- Demo/mission additions
- CI and packaging hardening

## Working on skills

When changing any skill in `skills/` or `.omx/skills/`:

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
   npm run skills:install -- --path ./dist/installed-skills
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

## Runtime `.omx` rule

These should **not** be committed:

- `.omx/logs/`
- `.omx/state/`
- `.omx/tmp/`
- `.omx/cache/`
- generated local-only runtime residue

These may be committed if they are part of the intended product contract:

- `.omx/skills/`
- `.omx/evidence/`
- `.omx/decisions.json`
- `.omx/release.json`

If uncertain, ask before committing new `.omx` paths.

## Branching and commits

Default workflow:

- branch from `main`
- open focused PRs
- avoid unrelated formatting churn
- keep release changes separate from feature changes when possible

Preferred commit styles:

- `feat: add <capability>`
- `fix: correct <behavior>`
- `docs: update <surface>`
- `ci: harden <workflow>`
- `chore: maintain <repo surface>`
- `chore(release): prepare v0.1.0`

## Pull requests

Every PR should include:

- what changed
- why it changed
- what files/surfaces were affected
- how it was tested
- whether docs were updated
- whether release behavior changed

If a PR changes skills, release automation, package metadata, or `.github/workflows`, it should be treated as release-sensitive.

## Release-sensitive changes

These require extra care:

- `package.json`
- `skills/index.json`
- `scripts/skills-*`
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
npm run skills:manifest
npm run skills:validate
npm run skills:pack
npm run skills:install -- --path ./dist/installed-skills
npm run check
npm test
```

And verify:

- no forbidden `.omx` runtime files are staged
- no accidental tarballs or temp outputs are committed
- docs are consistent with behavior
- release notes are updated if needed

## PR checklist

- [ ] My change is focused and intentional.
- [ ] I did not commit runtime `.omx` state.
- [ ] I updated relevant docs.
- [ ] I ran the skill packaging/validation flow.
- [ ] I included notes for any release-sensitive change.
- [ ] I did not weaken gate enforcement or hide failures.

## Release rule

Meta-Architect is production-oriented. If a change makes the repository less inspectable, less reproducible, or less strict about gates and evidence, it should not be merged until that regression is corrected.
