---
name: meta-architect-arch
description: "Use when Codex needs to run or explain the Meta-Architect `$arch` lane for architecture, stack rationale, subsystem layout, and blueprint decisions. Trigger for requests about architecture design inside a Meta-Architect-managed repo or for producing the first design artifact after `ma idea`."
---

# Meta-Architect Arch

Run the architecture lane through:

```bash
ma run $arch
```

Expected effects:
- Reads the recorded idea brief.
- Appends an architecture decision entry to `.ma/decisions.json`.
- Advances `architecture_status` to `APPROVED`.

Use this skill only after `ma idea` has captured a project brief.
