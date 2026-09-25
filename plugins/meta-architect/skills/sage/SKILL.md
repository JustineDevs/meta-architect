---
name: sage
description: "Use when the user wants evidence-backed technology choices, OSS evaluation, and source-grounded validation of the stack proposed in `$arch`."
---

# Sage

Use this skill inside Codex to verify or challenge stack choices with real sources. `$sage` remains the evidence gate even as Meta-Architect absorbs more native curation and reference packs.

## Output

Produce:
- candidate tools, libraries, or services
- `decision`, `status`, `evidence`, `blockers`, `next_allowed_triggers`
- why each option fits or fails the architecture
- source-backed evidence from official docs, upstream repos, or approved GitMCP sources
- evidence grade and exact upstream mapping
- recommendation with tradeoffs
- unresolved gaps or missing evidence
- exact next trigger, usually `$flow`

## Rules

- Follow this order:
  - use known upstream repos and official docs first when they already exist
  - use discovery accelerators to find or narrow candidates
  - map the selected candidate back to an exact upstream repo
  - verify against upstream repos and official docs before approving it
- Use `references/source-selection.md` when you need the native source-selection contract, evidence ladder, or packaged discovery rules.
- Use approved discovery accelerators when you need faster OSS candidate discovery:
  - Ossium (`https://ossium.live/home`) for trending, curated, YC-backed, and GSoC-linked OSS discovery
  - Trendshift (`https://trendshift.io/`) for rising GitHub engagement and topic momentum
  - Dev Hunt (`https://devhunt.org/`) for newly launched developer tools
  - Libraries.io (`https://libraries.io/`) for package/dependency metadata, with caution because its public data is scraped and not validated/curated for accuracy
  - Open Hub (`https://openhub.net/`) for project activity, contributor, and comparison signals
  - Open-source Projects (`https://www.opensourceprojects.dev/`) for curated OSS discovery and detailed project writeups
- Discovery accelerators are candidate-finding tools, not approval surfaces. The user-facing Meta-Architect product stays native even when evidence sources are external.
- Do not invent package capabilities or maturity claims.
- Prefer primary sources over summaries when validating technical details.
- Do not treat discovery listings alone as VERIFIED evidence; promote candidates to upstream repos and official docs before approving them.
- If the evidence is weak or contradictory, say so clearly and keep the recommendation conditional.
