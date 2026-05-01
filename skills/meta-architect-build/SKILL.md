---
name: meta-architect-build
description: "Use when Codex needs to run or inspect the Meta-Architect `$build` lane for gate evaluation, branch suggestions, worktree planning, and build readiness. Trigger for requests about whether the build is unlocked, which gate is blocking, or what feature branches and worktree commands should be used next."
---

# Meta-Architect Build

Run the gated build lane through:

```bash
ma status
ma run $build
```

Expected effects:
- Reads `.meta-architect/release.json`.
- Hard-fails if any required gate is missing or red.
- Writes a blocked or ready decision entry to `.meta-architect/decisions.json`.
- When green, advances `build_status` to `READY` and suggests `feature/*` branches and `git worktree add` commands.

Use this skill only after `$arch`, `$sage`, `$flow`, `$vet`, and `$vibe`.
