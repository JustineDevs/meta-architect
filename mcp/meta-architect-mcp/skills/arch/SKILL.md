---
name: arch
description: "Use when the user wants architecture-first product and system design with explicit stack rationale, boundaries, tradeoffs, data model choices, and phased delivery planning."
---

# Arch

Use this skill inside Codex to turn a product idea into a concrete architecture brief.

Load the machine-readable [`data/system-design-glossary.json`](../../data/system-design-glossary.json)
and use its terms consistently. The glossary is a bounded vocabulary, not a
universal catalog; qualify and cite any term that is not present.

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

## Procedure

1. State the problem, users, constraints, non-goals, and measurable definition of done.
2. Map the major components, data flows, trust boundaries, and ownership boundaries.
3. By default, classify the candidate architecture against the Software Architecture Guild style catalog: layered, modular, pipeline, microkernel, service-oriented, event-driven, space-based, orchestration-driven, and microservices.
4. Select the simplest applicable style or composition, explain its fit to functional and quality requirements, and record the rejected styles and their tradeoffs.
5. Cite the source-backed style guidance in the architecture decision. Use the pinned GitMCP source `software-architecture-guild/software-architecture-guild.github.io`; never present the catalog as a universal prescription.
6. Use glossary terms for the relevant domain, reliability, security, data, and delivery concepts; record why each term matters to the decision.
7. Define the smallest phased delivery plan, including migration and rollback considerations.
8. Hand the decision to `$sage` with open questions, the detected technology inventory, and evidence requirements.

## Quality bar

- Every subsystem has one responsibility and a clear interface.
- Operational, security, failure, and data-retention concerns are addressed.
- Recommendations distinguish known facts, assumptions, and decisions still requiring evidence.
- Architecture-style selection is evidence-backed, requirement-driven, and reversible; style names alone are not evidence.
- Glossary definitions never unlock an evidence gate; source receipts and project-specific reasoning remain required.

## Example

For a hosted MCP integration, cover endpoint transport, tool contracts, authentication, domain verification, skill distribution, deployment ownership, failure behavior, and the submission boundary before selecting a stack.
- Be explicit about tradeoffs, failure modes, and what should stay out of the first version.
