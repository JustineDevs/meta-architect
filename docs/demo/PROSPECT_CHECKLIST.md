# Prospect Demo Checklist

Use this before a live Meta-Architect demo.

## Preparation

- Map the prospect's top three objectives to MA features before the call.
- Use prospect-safe names and industry-relevant data.
- Remove `Demo Account`, `Test Company`, `Sample Co`, and competitor names from visible screens.
- Enable only relevant modules and docs for the story.
- Keep [Real Demo Runbook](./REAL_DEMO_RUNBOOK.md) open.

## Technology

- Run `npm run demo:smoke` before the call.
- Run `npm run release:verify` before the call.
- Keep a terminal tab ready at the repository root.
- Keep a backup terminal tab ready with the latest smoke JSON proof path.
- Disable desktop notifications, email popups, and distracting meeting overlays.
- Use readable terminal font size and screen resolution.

## Storytelling

- Start with the buyer problem, not the feature list.
- Make `$maestro` the one-entry workflow.
- Show Obsidian as semantic brain context, not build evidence.
- Tie every lane to a business outcome.
- Pause after each major proof point for questions.

## Proof Points

- Install path: jsDelivr or npm fallback.
- Runtime setup: `ma setup`, `ma doctor`, `ma status --maestro-view`.
- Orchestration: `$maestro` chooses safe next lanes.
- Knowledge: Obsidian notes are graph-linked and tagged as `vault_context`.
- Reliability: learning loop and environment awareness are included in smoke output.
- Execution: Ralph handoff is story-sized and gate-owned.
- Release: `npm run release:verify` passes.

## Leave-Behind

- Send [Demo Story](./DEMO_STORY.md).
- Send [Real Demo Runbook](./REAL_DEMO_RUNBOOK.md).
- Send [DEMO.md](../../DEMO.md).
- Confirm the next conversation date and the exact workspace or repository to evaluate.
