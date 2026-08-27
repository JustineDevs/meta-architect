# ADR 0007: Multi-Vendor Agent Registry with Symlink-First Distribution

**Status:** Accepted  
**Date:** 2026-08-24  
**Deciders:** justinedevs

## Context

Meta-Architect must preserve its Codex-first behavior while exposing the same
skill payload to other agent surfaces. Copying every skill into every host
directory creates drift and unnecessary disk usage; some filesystems also do
not permit symlinks.

## Decision

Use a small public agent-surface registry for command selection and detection,
with Codex as the default when `MA_AGENT` is unset. Keep the broader runtime
skill registry as the compatibility source for supported targets. Distribute
skill folders symlink-first and fall back to a content copy when links are not
available or `MA_PLUGIN_SYNC_MODE=copy` is selected. Verify both modes by
content and file mode.

## Consequences

- Existing Codex launcher and setup behavior remain the default.
- Claude Code and Cursor can be selected through `MA_AGENT` and have explicit
  command/skill contracts.
- Symlinked plugin mirrors use less disk and cannot silently drift from source.
- Copy fallback supports Windows, restricted worktrees, and archive workflows.
- Additional surfaces can be registered without changing launcher policy.

## Verification

`test/agents.test.js`, `test/plugin-sync.test.js`, `npm run check`, and the
existing CLI smoke tests cover registry selection, detection, copy fallback,
and default Codex delegation.
