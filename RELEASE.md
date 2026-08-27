# Meta-Architect v0.14.0

## Summary

This release ships Meta-Architect as a Codex-native skills system with:
- canonical install `npm i -g @openai/codex@latest @jstn-sdk/ma@latest`
- optional helper launch `ma --madmax --high`
- a singular in-session umbrella surface at `$maestro`
- a bounded autonomous manager control plane for `$maestro`
- a publishable non-gating helper family: `$align`, `$diagnose`, `$tdd`, `$cleanup`
- semantic core runtime artifacts for Obsidian, Ralph execution, context economy, prompt strategy, active autonomy, learning loops, environment awareness, and universal plugin brokering
- native packaged playbooks and reference packs through `mcp/native-playbooks.json`, `mcp/local/playbooks.js`, and `docs/reference/`
- a usage-workflow-driven gated path starting with the structured `$arch` prompt
- helper commands for setup, scripted validation, and branch/release gating
- package, skill bundle, and release surfaces aligned to `v0.14.0`

Target package state:
- npm package: `@jstn-sdk/ma@0.14.0`
- npm registry state: published as `latest`
- publishability note: `0.14.0` is the candidate package line and must be published only from the verified `v0.14.0` tag
- release tag: `v0.14.0`
- GitHub release: pending publish for `v0.14.0`

## Verification

- `npm run release:check`
- `npm run linux:packages:build`
- `npm run linux:packages:smoke`
- `npm run release:assets`
- `npm run release:assets:generate` followed by `npm run release:assets` publishes and verifies `SHA256SUMS`, an SPDX SBOM, and `release-summary.json` alongside every asset.
- Release binaries are generated in CI and published to the GitHub Release; `dist/` is intentionally not tracked, so stale versioned files cannot accumulate in Git.
- `npm publish --dry-run --access public --ignore-scripts`
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
- release docs, changelog, package metadata, and workflows all remain aligned to `v0.14.0`
- every `v0.14.0` issue in `docs/qa/release-issue-gates-0.14.0.json` is marked `passed` with implementation, verification, and production evidence

Current release-readiness state:
- `docs/qa/release-issue-gates-0.14.0.json` records all tracked `v0.14.0` issues as `passed` with implementation, verification, production proof, and labels
- local release gates passed before publish and must remain green for any follow-up PR
- npm publication: pending verification after the `v0.14.0` tag is published
