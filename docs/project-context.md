# Project Context Index

`ma setup` writes `.ma/context/project-index.json` from repository source files
and `package.json`. The record is marked `authority: source_truth`, includes a
source hash and changed-file list, and excludes generated directories, hidden
runtime directories, and secret-shaped filenames.

The generated fields describe languages, frameworks, package manager, scripts,
entry points, important documentation, Git provenance, and detected local agent
integrations. Human corrections belong under `humanOverrides`; setup preserves
that object on every refresh.

Refresh is incremental in its evidence: unchanged source metadata produces an
`unchanged` freshness status, while additions, deletions, and size/mtime changes
appear in `freshness.changedFiles`.

## Authority and conflicts

Context authority is ordered: `source_truth`, `verified_evidence`, `hook_evidence`,
`generated_context`, `vault_note`, `learning_memory`, `external_reference`, then
`stale`. Consumers select the highest-authority non-stale record and preserve
losing records as conflicts. Generated records carry `freshness.stale`,
`checkedAt`, `sourceHash`, and `sourceFiles`; refreshed source context supersedes
older generated context and vault notes. Learning memory is historical context
and never overrides source files or verified command, test, build, or lint output.

## Source-control policy

`.ma/` is a local runtime namespace by default. Commit only deliberately shared,
privacy-filtered templates or decisions; keep `.ma/context`, `.ma/state`,
`.ma/learning`, hook receipts, Obsidian configuration, caches, logs, and machine
paths local. The repository `.gitignore` ignores `.ma/` and setup reports the
policy through the generated layout, so local context cannot enter a commit by
accident. Teams that need shared context should publish reviewed, sanitized
documents outside the runtime namespace.

## Workspace boundaries

The index records `workspaces.packages` for declared npm workspaces and
discovered package boundaries, plus `nestedRepositories` for nested Git roots.
Consumers should scope commands, context, and hooks to the selected package
instead of treating a monorepo as one undifferentiated project.
