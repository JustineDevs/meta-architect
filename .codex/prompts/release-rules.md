# Release Rules

## Branch roles

- `dev` — the only human development and integration branch
- `main` — protected, release-facing branch
- `automation/*` — ephemeral workflow-owned branches only; never use them for development

## Merge rules

- Task work is completed on `dev`; it is never split into persistent feature branches.
- `ma merge` should only approve `dev -> main`.
- Build completion should be reflected before merge promotion.

## Release rules

- `ma release` should only approve `dev -> main`.
- No other source or target branch is a valid release path.
- Release claims must match actual channel execution.

## Artifact rules

- `skills/index.json` must be current.
- `dist/meta-architect-skills.tgz` must exist and be non-empty for a release that claims skill packaging readiness.
- Release docs and version lines must stay aligned.
