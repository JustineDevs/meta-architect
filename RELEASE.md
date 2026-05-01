# Meta-Architect v0.1.0

## Summary

This release converts Meta-Architect into a standalone product surface. The public launcher is now
`ma`, runtime state lives under `.ma/`, and the package no longer depends on an
external wrapper runtime.

`v0.1.0` is the standalone release line. In this repo, production means:
- the core workflows are reliable end-to-end,
- the public interface and contract are stable for the `1.x` line,
- and the release is backed by explicit QA and publishing evidence.

This release is therefore in scope for real project use, with future changes expected to preserve
the core trigger/status/branch contract unless introduced as a major-version break.

## Verification

- `node --test`
- `npm run check`
- `npm run skills:manifest`
- `npm run skills:validate`
- `npm run skills:pack`
- manual CLI flow recorded in `docs/qa/release-readiness-0.1.0.md`

## Operational bar

This release should not be treated as production unless:
- a fresh repo can run the documented workflow cleanly,
- at least one real GitMCP endpoint is successfully queried,
- the skill publication surface validates and packages,
- and the release body, changelog, and QA artifact all remain aligned.
