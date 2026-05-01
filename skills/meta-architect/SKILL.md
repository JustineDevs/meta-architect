---
name: meta-architect
description: "Use when Codex needs to run the full Meta-Architect workflow in this repo: initialize a project, capture an idea, execute the gated architecture, evidence, logic, security, experience, and build path, inspect status, and enforce merge/release policy. Trigger for requests about Meta-Architect orchestration, build gating, GitMCP-backed evidence, branch/worktree planning, or releasing through `development` and `prod`."
---

# Meta-Architect

## Overview

Run the end-to-end Meta-Architect operator workflow through the local `ma` CLI and the repo's release rules. Use this skill when the task is to drive the full gated project lifecycle rather than a single specialized lane.

## Workflow

1. Confirm the repo is initialized:
   ```bash
   ma setup
   ```
2. Capture the project brief:
   ```bash
   ma idea "Build a real-time collaborative whiteboard for product teams"
   ```
3. Execute the core skill pipeline in order:
   ```bash
   ma run $arch
   ma run $sage
   ma run $flow
   ma run $vet
   ma run $vibe
   ma status
   ma run $build
   ```
4. If implementation is complete and branch policy allows it:
   ```bash
   ma merge feature/ui development
   ma release development prod
   ```

## Rules

- Treat the local `ma` CLI as the source of truth for status transitions.
- Do not bypass build gates by editing `.ma/decisions.json` or `.ma/release.json` manually.
- Use repo-specific GitMCP endpoints from `mcp/servers.json`.
- Keep worktrees optional and operator-driven.

## References

- For release gates and branch policy, read `references/core-release-rules.md`.
