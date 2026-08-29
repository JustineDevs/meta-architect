# ADR 0003: Optional Maestro Pi Control Model

**Status:** Accepted for experimental opt-in
**Date:** 2026-08-24
**Author:** justinedevs
**Deciders:** justinedevs

## Context

`$maestro` currently uses a deterministic, bounded manager contract. An LLM-driven
tool loop could improve dispatch ergonomics, but replacing the default control model
could weaken gate enforcement or change release-state ownership.

## Decision

Provide an isolated Maestro Pi control surface behind `MA_MAESTRO_PI=1`.
`beforeToolCall` remains a hard enforcement boundary, `afterToolCall` is the only
integration point for decision receipts, and `waiting-review` terminates dispatch.
The deterministic `$maestro` path remains the default. The optional dependency is
not required for installation; when unavailable, execution falls back to the
deterministic path and reports that the experimental adapter was not handled.

## Consequences

The stable workflow contract is unchanged and gate checks cannot be bypassed by
tool selection. The experimental path requires a separately verified Pi control
runtime before it can become a default or release gate participant.
