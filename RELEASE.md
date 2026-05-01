# Meta-Architect v1.0.0

## Summary

This release ships the core orchestration and skills surface for Meta-Architect, including gated build readiness, live GitMCP-backed evidence probing, and merge/release policy enforcement.

`v1.0.0` is intended as the first production core release. In this repo, production means:
- the core workflows are reliable end-to-end,
- the public interface and contract are stable for the `1.x` line,
- and the release is backed by explicit QA and publishing evidence.

This release is therefore in scope for real project use, with future changes expected to preserve the core trigger/status/branch contract unless introduced as a major-version break.

## Verification

- `node --test`
- `npm run check`
- `npm run skills:manifest`
- `npm run skills:validate`
- `npm run skills:pack`
- manual CLI flow recorded in `docs/qa/release-readiness-1.0.0.md`

## Operational bar

This release should not be treated as production unless:
- a fresh repo can run the documented workflow cleanly,
- at least one real GitMCP endpoint is successfully queried,
- the skill publication surface validates and packages,
- and the release body, changelog, and QA artifact all remain aligned.
