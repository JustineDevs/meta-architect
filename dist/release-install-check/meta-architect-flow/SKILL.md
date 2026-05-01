---
name: meta-architect-flow
description: "Use when Codex needs to run or inspect the Meta-Architect `$flow` lane for business logic, state transitions, and blockers. Trigger for requests about logic maps, dead ends, state validation, or whether the workflow is ready to proceed to security review."
---

# Meta-Architect Flow

Run the logic-validation lane through:

```bash
ma run $flow
```

Expected effects:
- Records a logic and state-transition review in `.omx/decisions.json`.
- Advances `logic_status` to `GREEN` or leaves blockers visible when unresolved.

Use this skill after evidence binding and before `$vet`.
