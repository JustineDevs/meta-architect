# Meta-Architect v0.1.12

## Summary

This release ships Meta-Architect as a Codex-native skills system with:
- canonical install `npm i -g @openai/codex@latest @jstn-sdk/ma@latest`
- optional helper launch `ma --madmax --high`
- a singular in-session umbrella surface at `$maestro`
- a bounded autonomous manager control plane for `$maestro`
- a publishable non-gating helper family: `$align`, `$diagnose`, `$tdd`, `$cleanup`
- native packaged playbooks and reference packs through `mcp/native-playbooks.json`, `mcp/local/playbooks.js`, and `docs/reference/`
- a usage-workflow-driven gated path starting with the structured `$arch` prompt
- helper commands for setup, scripted validation, and branch/release gating
- package, skill bundle, and release surfaces aligned to `v0.1.12`

Target package state:
- npm package: `@jstn-sdk/ma@0.1.12`
- npm registry state: pending publish
- publishability note: this branch is prepared for the next publishable package line, `0.1.12`
- release tag: `v0.1.12`
- GitHub release: pending publish for `v0.1.12`

## Verification

- `npm run release:check`
- `npm run linux:packages:build`
- `npm run linux:packages:smoke`
- `npm run release:assets`
- installed-package setup and launch smoke
- autonomous manager and helper/gated regression coverage through `npm test`

## Operational bar

This release is only considered real if:
- `@jstn-sdk/ma@latest` installs cleanly
- `ma --madmax --high` delegates into Codex as expected
- `ma setup` creates the documented `.ma` runtime surfaces
- `$maestro` remains the only umbrella surface
- helper skills stay non-gating and Meta-Architect-owned
- the gated workflow remains coherent from `$arch` to `$build`
- native playbooks and support-bundle references load correctly
- release docs, changelog, package metadata, and workflows all remain aligned to `v0.1.12`

Current blocker:
- npm publication has not been run yet for `@jstn-sdk/ma@0.1.12`
