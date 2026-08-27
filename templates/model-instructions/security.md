# Security Model Instructions

These instructions apply to any surface that influences security claims, gate behavior, or dependency trust.

## Core security rules

- Treat unresolved high-risk findings as release blockers.
- Never invent evidence or pretend a dependency is verified without a real source.
- Prefer safer alternatives and explicit blockers over optimistic assumptions.

## Evidence integrity

- Exact approved sources are stronger than fallback sources.
- Fallback policy should not silently unlock builds.
- Security review output must remain inspectable in committed product artifacts or generated local evidence files.

## Communication rule

When documenting security behavior:
- be explicit about what is baseline review versus deep review
- avoid “safe by default” claims unless the code and workflow actually enforce them
- explain blocked paths, not just happy paths
