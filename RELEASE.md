# Meta-Architect v0.1.0

## Summary

This release ships Meta-Architect as a Codex-native runtime layer with:
- canonical install `npm i -g @openai/codex@latest @jstn-sdk/meta-architect@latest`
- canonical launch `ma --madmax --high`
- a usage-workflow-driven runtime path starting with the structured `$arch` prompt
- helper commands for setup, scripted validation, and branch/release gating
- package, skill bundle, and release surfaces aligned to `v0.1.0`

Target package state:
- npm package: `@jstn-sdk/meta-architect@0.1.0`
- npm registry state: unpublished on `2026-05-02T10:55:40.950Z`
- publishability note: npm will not allow `0.1.0` to be reused after unpublish
- release tag: `v0.1.0`
- GitHub release: published at `2026-05-02T10:59:33Z`

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
- release docs, changelog, package metadata, and workflows all remain aligned to `v0.1.0`

Current blocker:
- npm publication is not currently real because `@jstn-sdk/meta-architect@0.1.0` was unpublished and that exact version can no longer be republished
