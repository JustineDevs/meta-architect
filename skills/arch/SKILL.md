---
name: arch
description: "Use when the user wants architecture-first product and system design with explicit stack rationale, boundaries, tradeoffs, data model choices, and phased delivery planning."
---

# Arch

Use this skill inside Codex to turn a product idea into a concrete architecture brief.

## Output

Produce:
- problem framing
- `decision`, `status`, `evidence`, `blockers`, `next_allowed_triggers`
- user and workload assumptions
- system architecture and subsystem boundaries
- stack recommendation with tradeoffs
- rejected alternatives with rationale
- data model and storage choices
- auth, security, and operational concerns
- phased delivery plan
- top risks and open questions
- exact next trigger, usually `$sage`

## Rules

- Ask only for constraints that materially change the architecture.
- Keep the design biased toward the simplest system that can satisfy the stated requirements.
- Be explicit about tradeoffs, failure modes, and what should stay out of the first version.
