# Runtime retention

## Redaction vault

The redaction vault is local-only state at `.ma/state/redaction-vault.json`. It
stores raw values only to preserve stable placeholders for provider-safe output;
raw values are never included in public receipts or exported context. The vault
file is restricted to mode `0600` and its directory to `0700` on supported hosts.

Entries are compacted on load/save. The default policy retains entries for 30
days and at most 200 entries. Operators can lower or raise bounded values with
`MA_REDACTION_VAULT_RETENTION_DAYS` (1-3650) and
`MA_REDACTION_VAULT_MAX_ENTRIES` (1-10000). Run `ma doctor` to detect broad
permissions and `ma redaction purge --dry-run` to preview deletion; run
`ma redaction purge` to remove the vault immediately.

`ma setup` compacts local runtime state after a successful setup. Recent files
remain active; stale or over-budget logs, hook receipts, learning records, and
recovery receipts are removed and represented by privacy-safe metadata in
`.ma/archive/runtime-summary.jsonl`.

The default policy retains up to 100 active records and 5 MiB of active state
per compaction run, with a 30-day age window. Archived summaries contain only
relative path, byte size, modification time, and removal reason. They never
copy record contents, secrets, prompts, or absolute machine paths.

`ma doctor` reports runtime-state integrity findings and warns when `.ma`
exceeds the 50 MiB state budget. Atomic writes and subsystem locks prevent
partial records while compaction is running.

Hook audit previews are privacy-safe by default. Assistant and user preview
text is truncated, passed through the shared redaction policy, and persisted
only with non-sensitive placeholder metadata. Raw tokens, identities, private
keys, credentials, and local paths are never written to `.ma/hooks/audit.log`.
