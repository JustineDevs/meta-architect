# Native Style And Deslop

Meta-Architect treats prose cleanup and anti-slop work as helper behavior, not as a separate umbrella workflow.

## Core rules

- prefer deletion over addition
- preserve behavior while simplifying
- remove generic AI filler from user-facing docs
- keep naming concise and Meta-Architect-native
- lock behavior with tests before cleanup when code paths are involved

## Routing

- use `$cleanup` for final-pass simplification and prose cleanup
- return to `$maestro` or the owning gated lane after cleanup decisions are made

## Non-goal

Do not ship raw third-party “humanizer” or “stop-slop” identities as first-class product surfaces.
