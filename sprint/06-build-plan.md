# Sprint 6: Build Plan

## Goal

Evaluate all required gates and prepare bounded implementation work.

## Inputs

- required upstream gates green or waived per release policy

## Expected outputs

- blocked or ready decision entry
- `build_status = READY` on success
- suggested `feature/*` branches
- optional `git worktree add` commands

## Exit criteria

- build is either clearly blocked or clearly ready
- branch/worktree guidance is explicit when ready

## Failure conditions

- missing or red gates
- invalid release-state file
