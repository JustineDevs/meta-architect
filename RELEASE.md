# Meta-Architect v0.1.1

## Summary

This release ships Meta-Architect as a Codex-native runtime layer with:
- canonical install `npm i -g @openai/codex@latest @jstn-sdk/meta-architect@latest`
- canonical launch `ma --madmax --high`
- a usage-workflow-driven runtime path starting with the structured `$arch` prompt
- helper commands for setup, scripted validation, and branch/release gating
- package, skill bundle, and release surfaces aligned to `v0.1.1`

Published package state:
- npm package: `@jstn-sdk/meta-architect@0.1.1`
- npm dist-tag: `latest`
- published at: pending publish
- release tag: `v0.1.1`

Recovery note:
- stale scoped version `0.1.0` has been deprecated on npm
- incorrect GitHub `v0.1.0` release/tag surfaces were removed
- `0.1.1` is the next correct publishable version and must be used for the fixed public package

## Verification

- `npm run release:check`
- installed-package setup and launch smoke
- helper flow through `ma idea`, `ma run '$arch'`, `ma run '$sage'`, `ma run '$flow'`, `ma run '$vet'`, `ma run '$vibe'`, `ma status`, and `ma run '$build'`

## Operational bar

This release is only considered real if:
- `@jstn-sdk/meta-architect@latest` installs cleanly
- `ma --madmax --high` delegates into Codex as expected
- `ma setup` creates the documented `.ma` runtime surfaces
- the usage-workflow sequence remains coherent from `$arch` to `$build`
- release docs, changelog, package metadata, and workflows all remain aligned to `v0.1.1`
