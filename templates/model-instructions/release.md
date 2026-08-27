# Release Model Instructions

These instructions apply when generating or reviewing release-facing artifacts.

## Release posture

Fail closed on:
- missing release artifacts
- failing checks
- blocked channels
- ambiguous publish claims

## Versioning rule

Preserve stable public contracts for the active release line unless a major version is intentionally planned.

## Publication rule

Never claim a publication channel succeeded without concrete evidence.

This includes:
- git branch push
- tag push
- GitHub release creation
- GitHub asset upload
- npm publish
- plugin or marketplace publish

## Release artifact minimum

Release-facing changes should stay aligned across:
- `package.json`
- `CHANGELOG.md`
- `RELEASE.md`
- `docs/qa/`
- `skills/index.json`
- tarball outputs

## Hygiene rule

Do not ship local runtime state, caches, or accidental build outputs as public source.
