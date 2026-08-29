# Continuity Graph

Meta-Architect keeps `memory/notes.md` as the human-readable continuity log
and maintains a validated graph beside it at `.ma/memory/graph.json`.

`storeContinuityNote` remains backward compatible. Each accepted note creates a
session node, resolves explicit or detected entities, and creates `mentions`,
`co_occurs`, and supplied relationship edges. Writes still pass through the
leader-authority gate; refused writes become proposals instead of mutating
shared memory.

The local MCP surface exposes:

- `memory://notes` and `memory://index` for existing consumers
- `memory://graph` for the validated graph
- `memory.query_graph` for bounded multi-hop traversal

The derived Graphify index at `.ma/context/graphify/index.json` links project,
continuity, task, workspace, decision, manager, and configured Obsidian state.
It is read-only and rebuilt from runtime state. Obsidian remains an external
human knowledge surface; its vault is never treated as authoritative over
current source files or authority-gated runtime state.

The graph model follows the useful graph-oriented shape of obsidian-mind and
Graphify without requiring either project as a runtime dependency. This keeps
installation deterministic while retaining the existing markdown compatibility
path.
