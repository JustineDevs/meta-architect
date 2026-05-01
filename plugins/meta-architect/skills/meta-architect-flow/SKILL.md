---
name: meta-architect-flow
description: "Use when Codex needs to run or inspect the Meta-Architect `$flow` lane for business logic, state transitions, and blockers. Trigger for requests about logic maps, dead ends, state validation, or whether the workflow is ready to proceed to security review."
---

# Meta-Architect Flow

## Description

This skill validates the business-logic and state-transition lane for Meta-Architect as a structured first-pass review.

## Trigger usage

```text
Use $meta-architect-flow to verify that the workflow logic and state transitions are explicit before security and build planning.
```

## Required inputs

- architecture approved
- evidence at least partial

## Output contract

Expected output:
- logic review entry in `.meta-architect/decisions.json`
- explicit blocker or green decision
- prerequisite-based blocking when architecture or evidence is not ready

## Gate and status implications

- sets `logic_status`
- can block the workflow when prerequisite states are not satisfied

## Realistic example

Input:

```bash
ma run '$flow'
```

Expected review:
- the kernel’s canonical state list
- unresolved blockers
- prerequisite blockers when the lane cannot turn green
- a baseline first-pass logic record rather than a domain-specific whiteboard or product-state analyzer

## Failure example

Bad behavior:
- returns `GREEN` without even checking prerequisite state
- hides unresolved transition ambiguity

## Explicit input/output example

Input:

```bash
ma run '$flow'
```

Output expectation:
- `.meta-architect/decisions.json` updated
- `.meta-architect/release.json` shows `logic_status = GREEN` only when acceptable

## Related surfaces

- [prompts/flow.md](../prompts/flow.md)
- [docs/skills.md](../docs/skills.md)
- [docs/release-spec.md](../docs/release-spec.md)
