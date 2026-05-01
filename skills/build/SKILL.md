---
name: build
description: "Use when the user wants to decide whether implementation is ready, what remains blocked, and what the exact next build step should be."
---

# Build

Use this skill inside Codex to convert the earlier review lanes into an implementation-ready decision.

## Output

Produce:
- current readiness verdict
- blockers that still prevent implementation
- the narrowest viable build slice
- branch or worktree suggestions when relevant
- test and verification expectations
- the exact next implementation step

## Rules

- Do not claim readiness if architecture, evidence, logic, security, or DX/UX gaps remain unresolved.
- Keep the recommended build slice small, testable, and reversible.
- If the user wants code immediately and the path is clear, end with a concrete implementation plan rather than more review prose.
