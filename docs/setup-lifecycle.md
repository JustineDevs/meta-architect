# Setup Lifecycle

`ma setup` records the artifacts it manages in `.ma/state/setup-receipt.json`.
The receipt is the ownership boundary for recovery operations; files that were
already present are recorded but are never removed by rollback.

## Commands

```bash
ma setup
ma setup --json
ma setup --rollback
ma setup --rollback --dry-run
ma uninstall
```

`ma setup --rollback --dry-run` reports only artifacts marked `created` without
changing files. `ma setup --rollback` and `ma uninstall` remove only artifacts marked `created`
by the latest setup receipt. Non-empty directories and existing user files are
preserved. Setup uses `.ma/state/.setup.lock` to reject concurrent runs, and
JSON runtime state is written through a temporary file followed by an atomic
rename.

Runtime `.log` and `.jsonl` files are pruned to 100 files and 5 MiB during
setup. The receipt is local runtime state and should not be committed.
