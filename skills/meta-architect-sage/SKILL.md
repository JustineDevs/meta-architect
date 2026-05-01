---
name: meta-architect-sage
description: "Use when Codex needs to run or inspect the Meta-Architect `$sage` lane for OSS evidence binding through GitMCP and MCP. Trigger for requests about verifying repos, collecting evidence from configured GitMCP endpoints, or checking whether a recommendation is VERIFIED, PARTIAL, or UNVERIFIED."
---

# Meta-Architect Sage

Run the evidence-binding lane through:

```bash
ma run $sage
```

Expected effects:
- Validates configured endpoints in `mcp/servers.json`.
- Performs a live MCP probe against at least one configured GitMCP server when network access is available.
- Writes evidence records to `.ma/evidence/sources.json`.
- Advances `evidence_status` to `VERIFIED`, `PARTIAL`, or `MISSING`.

Do not invent repos or endpoints. If no valid evidence is available, keep the result unverified.
