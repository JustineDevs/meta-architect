# Changelog

## v0.1.4

- Release line prepared automatically for v0.1.4.

## v0.1.3

- Adds the standardized installed support bundle under `CODEX_HOME/meta-architect-sdk` so relevant packaged files are available without path guessing.
- Makes the helper launch self-healing by reinstalling missing Meta-Architect skills before starting Codex.
- Aligns installed skill display names to the real trigger names such as `$arch`, `$vibe`, and `$build`.

## v0.1.1

- Carries the skills-first product sanitization, the `@jstn-sdk/ma` package identity, and the repository state beyond the already-published `0.1.0` package.
- Keeps the in-session skill workflow as the primary product surface and the `ma` helper path as secondary support only.
- Aligns package metadata, plugin metadata, release docs, prompts, tests, and workflow wording to the `v0.1.1` release line.

## v0.1.0

- Released Meta-Architect as a Codex-native skills system with `ma --madmax --high` as a secondary guided start posture.
- Standardized the runtime namespace on `.ma`.
- Aligned package metadata, install guidance, release docs, and workflows to the `@jstn-sdk/ma` package and `v0.1.0` release line.
- Added install/package/workflow smoke validation for the helper and usage-workflow paths.
- Added explicit plugin marketplace metadata, plugin mirror verification, and postinstall skill installation to the published package.
- Refreshed `DEMO.md`, `COVERAGE.md`, release docs, and packaging surfaces to match the real shipped package.
