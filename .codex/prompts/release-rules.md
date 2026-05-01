# Release Rules

## Branch roles

- `feature/*` — bounded task work
- `development` — integration branch
- `release/*` — optional stabilization branch
- `prod` — production release branch

## Merge rules

- Task work merges into `development`, never directly into `prod`.
- `ma merge` should only approve `feature/* -> development`.
- Build completion should be reflected before merge promotion.

## Release rules

- `ma release` should only approve:
  - `development -> prod`
  - `release/* -> prod`
- No direct `feature/* -> prod` promotion.
- Release claims must match actual channel execution.

## Artifact rules

- `skills/index.json` must be current.
- `dist/meta-architect-skills.tgz` must exist and be non-empty for a release that claims skill packaging readiness.
- Release docs and version lines must stay aligned.
