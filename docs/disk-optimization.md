# Disk-Bounded Test and Review Runs

Meta-Architect keeps test and review fixtures under `/tmp/ma-tests`. The shared lifecycle is implemented in [`src/test-fixtures.js`](../src/test-fixtures.js) and is used by repository-copy tests and smoke scripts.

## Defaults

- Every namespace contains a sanitized test name, a timestamp, and random identifiers.
- Generated directories are excluded from project copies: `.git`, `node_modules`, `dist`, `.next`, `.ma`, `.codex`, and legacy `.omx` orchestration state. Meta-Architect runtime state remains under `.ma/`.
- Reflinks are attempted first. `rsync` is the safe fallback, followed by ordinary file copies.
- Hardlinks are opt-in only (`{ useHardlinks: true }`) because writes through a hardlink can mutate the source tree; use them only for immutable fixtures.
- Fixture copies and streamed logs fail closed at the 50 MiB hard budget; the shared root is capped at 1 GiB.
- Active namespaces carry a PID lease marker so scheduled cleanup does not remove a live test.
- Process shutdown removes registered namespaces. Tests that need retained evidence can call `compressMaState()` before cleanup; archives are stored under `/tmp/ma-tests/retained` and retained for seven days.
- Test summaries are capped at 1 MiB while full output remains streamed to the log file.

## Cleanup

Run the idempotent cleanup command locally or in CI:

```bash
npm run fixtures:cleanup
```

The script removes compressed state older than seven days, logs older than three days, and namespaces older than one day. It refuses paths outside `/tmp/ma-tests`, preserves the retained archive directory, and prunes all expired namespaces when the root exceeds 2 GiB.

CI checks `/tmp` before tests, reports the ten largest namespaces afterward, and cleans the producing runner. The scheduled cleanup workflow is a best-effort maintenance check for its own runner; hosted runners are ephemeral, so it is not treated as historical storage.

## Measuring a change

Use `npm run test:disk` for the lifecycle tests. Fixture budgets are:

| Budget | Limit |
| --- | ---: |
| Typical fixture | 20 MiB |
| Hard fixture limit | 50 MiB |
| Shared namespace root | 1 GiB |
| Cleanup escalation | 2 GiB |
| Summary log | 1 MiB |

The limits are guardrails, not evidence that every arbitrary project can fit in memory. Large integration fixtures must declare why they exceed the typical budget and must still remain below the hard limit.

## Verification

The current repository verification on 2026-08-24 recorded:

- `node --test test/test-fixtures.test.js`: 11/11 passed.
- `npm test`: 185/185 passed with sequential test execution.
- 100 minimal-fixture creations: 298-byte maximum fixture, 92 ms total setup time.
- Cleanup left `/tmp/ma-tests` with no fixture or archive files; only the empty control directories remained.

These measurements cover the shared fixture helpers and repository test suite. They do not claim that arbitrary external projects have the same footprint.
