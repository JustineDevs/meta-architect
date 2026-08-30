# Sprint 7: Release

## Goal

Move from completed bounded implementation to a controlled merge and release path.

## Inputs

- `build_status = READY | RUNNING`
- valid branch origin

## Expected outputs

- `merge_status = MERGED_TO_DEVELOPMENT`
- `release_status = SHIPPED_TO_PROD`

## Exit criteria

- merge follows `feature/* -> dev`
- release follows `dev|release/* -> main`

## Failure conditions

- invalid merge target
- invalid release origin
- attempt to bypass protected release flow
