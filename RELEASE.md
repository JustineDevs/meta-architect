# Meta-Architect v0.1.5

## Summary

This release ships Meta-Architect as a Codex-native skills system with:
- canonical install `npm i -g @openai/codex@latest @jstn-sdk/ma@latest`
- optional helper launch `ma --madmax --high`
- a usage-workflow-driven runtime path starting with the structured `$arch` prompt
- helper commands for setup, scripted validation, and branch/release gating
- package, skill bundle, and release surfaces aligned to `v0.1.5`

Target package state:
- npm package: `@jstn-sdk/ma@0.1.5`
- npm registry state: pending publish
- publishability note: `0.1.4` is already published, so `0.1.5` is the next publishable package line
- release tag: `v0.1.5`
- GitHub release: pending publish for `v0.1.5`

## Verification

- `npm run release:check`
- installed-package setup and launch smoke
- helper flow through `ma idea`, `ma run '$arch'`, `ma run '$sage'`, `ma run '$flow'`, `ma run '$vet'`, `ma run '$vibe'`, `ma status`, and `ma run '$build'`

## Operational bar

This release is only considered real if:
- `@jstn-sdk/ma@latest` installs cleanly
- `ma --madmax --high` delegates into Codex as expected
- `ma setup` creates the documented `.ma` runtime surfaces
- the usage-workflow sequence remains coherent from `$arch` to `$build`
- release docs, changelog, package metadata, and workflows all remain aligned to `v0.1.5`

Current blocker:
- npm publication has not been run yet for `@jstn-sdk/ma@0.1.5`
