# ADR 0004: Zero-Dependency TTY Status Grid

**Status:** Accepted
**Date:** 2026-08-29
**Author:** justinedevs

## Context

Status and doctor output is primarily read in terminals, but non-interactive
output is consumed by scripts and existing tests. A dependency-backed renderer
would add installation and output risk for a small formatting problem.

## Decision

Use pure standard-library grid functions for TTY-only status and doctor output.
The existing line-oriented output remains unchanged when stdout is not a TTY.
The renderer is ASCII by default and has no impact on gate or runtime state.

## Consequences

Interactive users get aligned gate/check tables. Scripts retain the existing
stable output contract, and the package adds no terminal UI dependency.
