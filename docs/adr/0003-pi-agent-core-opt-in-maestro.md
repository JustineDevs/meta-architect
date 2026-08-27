# ADR 0003: Optional pi-agent-core Control Model for Maestro

**Status:** Accepted for experimental opt-in
**Date:** 2026-08-24
**Author:** justinedevs
**Deciders:** justinedevs

## Context

`$maestro` currently uses a deterministic, bounded manager contract. An LLM-driven
tool loop could improve dispatch ergonomics, but replacing the default control model
could weaken gate enforcement or change release-state ownership.

## Decision

Provide an isolated pi-agent-core tool surface behind `MA_PI_AGENT_CORE=1`.
`beforeToolCall` remains a hard enforcement boundary, `afterToolCall` is the only
integration point for decision receipts, and `waiting-review` terminates dispatch.
The deterministic `$maestro` path remains the default. The optional dependency is
not required for installation; when unavailable, execution falls back to the
deterministic path and reports that the experimental adapter was not handled.

## Consequences

The stable workflow contract is unchanged and gate checks cannot be bypassed by
tool selection. The experimental path requires a separately verified pi-agent-core
package/API before it can become a default or release gate participant.
