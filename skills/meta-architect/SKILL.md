---
name: meta-architect
description: "Use when the user wants the full Meta-Architect workflow inside Codex: architecture-first planning, evidence-backed OSS selection, logic review, security review, DX/UX review, and build readiness without leaving the Codex session."
---

# Meta-Architect

## Overview

Run the full Meta-Architect workflow inside Codex. Use this skill when the user wants the gated design-and-review sequence rather than a single specialist lane.

## Workflow

1. Start with `$arch` and turn the user's goal into a concrete architecture brief.
2. Continue with `$sage` to validate core stack choices against official docs or approved repo-backed sources.
3. Run `$flow` to map states, transitions, invariants, and blockers.
4. Run `$vet` to review trust boundaries, auth, data handling, and abuse paths.
5. Run `$vibe` to review developer and user experience quality.
6. Finish with `$build` to decide whether implementation is ready, what remains blocked, and what the exact next execution step should be.

## Rules

- Stay inside Codex unless the user explicitly asks for repo-local helper commands.
- Keep the workflow architecture-first. Do not jump into code before the architecture and review lanes are grounded.
- Prefer official docs, upstream repos, and repo-configured GitMCP sources when validating tooling choices.
- End each lane with a clear result shape: decision, evidence, blockers, and exact next trigger.

## References

- For release gates and branch policy, read `references/core-release-rules.md`.
