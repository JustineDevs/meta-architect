---
name: meta-architect-vibe
description: "Use when Codex needs to run or inspect the Meta-Architect `$vibe` lane for developer-experience and user-experience review before build execution. Trigger for requests about DX friction, UX risks, operator flow quality, or whether the experience gate should be GREEN or WAIVED."
---

# Meta-Architect Vibe

Run the experience-review lane through:

```bash
ma run $vibe
```

Expected effects:
- Writes experience notes to `.meta-architect/evidence/outcomes.json`.
- Appends a DX/UX decision entry to `.meta-architect/decisions.json`.
- Advances `experience_status` to `GREEN` when the flow is acceptable.

Use this skill before `$build`.
