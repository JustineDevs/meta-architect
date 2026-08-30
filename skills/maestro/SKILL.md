---
name: maestro
description: "Use when the user wants the singular Meta-Architect in-session autonomous manager: choose the best next workflow step, manage the fixed gated workflow, and route bounded helper handoffs inside Codex."
---

# Maestro

## Overview

Use this skill inside Codex as the singular Meta-Architect umbrella surface and persistent autonomous manager. It accepts one task or a durable batch, inspects workflow state, chooses the smallest safe next step, manages the fixed gated design-and-review sequence, and keeps resuming eligible work until each task is completed, blocked, cancelled, or failed. It never invents a second umbrella command. There is no separate shipped `$meta-architect` skill.

## Workflow

1. Inspect the current gate state, active evidence, and current blockers.
2. Choose the smallest safe next step and decide whether the next move is:
   - a direct advisory result
   - a helper-skill handoff
   - a gated-lane handoff
3. When the issue is alignment, diagnosis, regression-first execution, or final-pass cleanup, hand work to the publishable but non-gating helper skills:
   - `$align`
   - `$diagnose`
   - `$tdd`
   - `$cleanup`
4. When the user wants the full Meta-Architect workflow, manage the fixed gated sequence without inventing new gates or skipping lane ownership:
   - `$arch`
   - `$sage`
   - `$flow`
   - `$vet`
   - `$vibe`
   - `$build`
5. End with a clear result shape: decision, evidence, blockers, the lane assignment if any, and the exact next trigger.

## Autonomous task loop

For a task or batch, keep the manager loop active across turns:

1. Normalize the request into the durable `.ma` task contract before dispatch.
2. Discover the selected host, available skills, and required lane syntax without taking ownership of user-installed assets.
3. Dispatch independent tasks with bounded concurrency and preserve dependency order for dependent tasks.
4. Inspect, implement, test, review, repair, and verify. Route a failure back to its owning lane with the failure evidence attached.
5. Persist checkpoints, receipts, and the next trigger after every transition so an interrupted process can resume safely.
6. Continue unaffected batch tasks when one task is blocked, then return a batch summary with terminal states and unresolved blockers.

Routine local work continues without asking for another prompt. Stop only for credentials, destructive actions, production or external mutations, explicit approval gates, unsafe commands, unavailable required providers, or missing verification evidence.

## Output

Produce:
- current situation summary
- best next step
- why that step is next
- recommended lane or assignment
- what to avoid doing yet
- exact next trigger, command, or handoff

## Rules

- Prefer the smallest next step that moves the workflow forward safely.
- Continue eligible work until the current task or batch reaches a terminal state; do not stop after a single successful lane.
- Treat persisted `.ma` state as the source for resume, deduplication, dependency ordering, cancellation, and bounded retries.
- Keep autonomous execution bounded by task dependencies, concurrency limits, deadlines, retry limits, and explicit safety gates.
- Respect current gate state before recommending implementation or release work.
- Be explicit when more evidence, planning, or validation is still needed.
- Treat the in-session skill flow as primary. Use `ma ...` terminal helpers only when repo-local setup, inspection, or scripted state automation is explicitly the better support path.
- Keep `$maestro` as the only umbrella surface. It owns next-step management and bounded handoff decisions, but it does not replace the outputs owned by the gated lanes.
- Helper skills are publishable mirrors, but they are non-gating. They support a lane and then hand control back to `$maestro` or the fixed gated sequence.
- Do not expand the release-gated sequence for this release. Gate ownership stays with `$arch -> $sage -> $flow -> $vet -> $vibe -> $build`.
- Stay inside Codex unless the user explicitly asks for repo-local helper commands.
- Keep the workflow architecture-first. Do not jump into code before the architecture and review lanes are grounded.
- Use approved discovery accelerators such as Ossium, Trendshift, Dev Hunt, Libraries.io, Open Hub, and Open-source Projects when you need faster OSS candidate discovery, then validate any promising project through upstream repos and official docs.
- Keep the `$sage` order explicit: known upstream sources first, discovery accelerators second, exact repo mapping third, approval only after upstream verification.
- Prefer official docs, upstream repos, and repo-configured GitMCP sources when validating tooling choices.
- For release gates and branch policy, read `references/core-release-rules.md`.
- For the native helper-family contract and pattern classification, read `references/native-ingest-map.md`.
