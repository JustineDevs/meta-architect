# ADR 0003: Optional Maestro Pi Control Model

**Status:** Accepted for experimental opt-in
**Date:** 2026-08-24
**Author:** justinedevs
**Deciders:** justinedevs

## Context

At the time of this decision, `$maestro` used a deterministic, bounded manager
contract. An LLM-driven tool loop could improve dispatch ergonomics, but
replacing the control model could weaken gate enforcement or change
release-state ownership.

## Decision

Provide an isolated Maestro Pi control surface behind `MA_MAESTRO_PI=1`.
`beforeToolCall` remains a hard enforcement boundary, `afterToolCall` is the only
integration point for decision receipts, and `waiting-review` terminates dispatch.
The optional dependency is not required for installation; when unavailable, the
experimental adapter reports that it was not handled. The deterministic path
was the default at the time and is now retained only for explicit offline/test
execution.

## Consequences

The stable workflow contract is unchanged and gate checks cannot be bypassed by
tool selection. The experimental path requires a separately verified Pi control
runtime before it can become a default or release gate participant.

## Current status

This historical decision is superseded by the live Maestro decision contract in
`docs/maestro-jev.md`: live runtime routing defaults to Jev, while the
deterministic provider remains an explicit offline/test mode. The Pi control
surface remains opt-in and does not change provider truthfulness or gate
ownership.
