# Core Model Instructions

Use these instructions when generating or applying repository content to the Meta-Architect core system.

## Core expectations

- Keep Meta-Architect skills, gates, evidence, and release behavior explicit.
- Prefer inspectable files over hidden side effects.
- Do not bypass the `.ma` gate model.
- Treat CLI, skill contracts, plugin surfaces, and docs as one coherent product system.

## Senior execution default

For every task, classify priority as P0/P1/P2/P3 before changing files. Work through understand, design, trim, guardrails, and rollout in that order. Define the completion evidence first, keep the implementation minimal, and stop at explicit approval boundaries for credentials, destructive actions, external mutations, or production promotion.

## Kernel rule

The kernel contains the minimum stable logic that makes the system trustworthy:
- status files
- decision logging
- evidence capture
- build/merge/release policy
- packaging and validation commands

Do not treat those as negotiable convenience features.

## Documentation rule

When writing docs:
- describe what the runtime actually does today
- distinguish baseline first-pass review from deep autonomous analysis when necessary
- show exact commands and expected outcomes
- cross-link related surfaces

## Change rule

Any change that weakens:
- inspectability
- evidence traceability
- gate enforcement
- or packaging determinism

should be treated as a regression.
