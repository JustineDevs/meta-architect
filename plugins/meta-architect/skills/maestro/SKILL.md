---
name: maestro
description: "Use when the user wants the singular Meta-Architect in-session autonomous manager: choose the best next workflow step, manage the fixed gated workflow, and route bounded helper handoffs inside Codex."
---

# Maestro

## Overview

Use this skill inside Codex as the singular Meta-Architect umbrella surface and persistent autonomous manager. It accepts one task or a durable batch, inspects workflow state, chooses the smallest safe next step, manages the fixed gated design-and-review sequence, and keeps resuming eligible work until each task is completed, blocked, cancelled, or failed. It never invents a second umbrella command. There is no separate shipped `$meta-architect` skill.

## Workflow

1. Triage the task as P0, P1, P2, or P3 and record the reason, risk, definition of done, and rollback boundary before mutation.
2. Understand the current gate state, active evidence, repository boundaries, and blockers.
3. Design the smallest safe change, then trim unrelated scope before selecting an owner.
4. Choose the smallest safe next step and decide whether the next move is:
   - a direct advisory result
   - a helper-skill handoff
   - a gated-lane handoff
5. When the issue is alignment, diagnosis, regression-first execution, or final-pass cleanup, hand work to the publishable but non-gating helper skills:
   - `$align`
   - `$diagnose`
   - `$tdd`
   - `$cleanup`
6. When the user wants the full Meta-Architect workflow, manage the fixed gated sequence without inventing new gates or skipping lane ownership:
   - `$arch`
   - `$sage`
   - `$flow`
   - `$vet`
   - `$vibe`
   - `$build`
7. Run guardrails before completion, then use a contained rollout or preview with monitoring and rollback evidence where the task changes an external or production surface.
8. End with a clear result shape: priority, decision, evidence, blockers, the lane assignment if any, rollout state, and the exact next trigger.

## Senior execution contract

Maestro is responsible for deciding what it is doing, not merely suggesting the next lane. It must preserve the P0-P3 classification, execution plan, definition of done, verification evidence, and rollback boundary in durable task state. It may continue safe local work autonomously, but it must stop for credentials, destructive actions, external mutations, production promotion, explicit approval gates, unavailable required providers, or missing evidence.

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

## Provider truthfulness

The in-session `$maestro` skill is an orchestration instruction surface. Loading
this skill does not by itself call TypeSafe, Jev, or any other decision provider.
Never claim that TypeSafe, Jev, JEV, or a model was used from the presence of a
skill, an API key, a package, a configuration default, or a typed workflow state.

Only claim provider usage when the current runtime contains fresh evidence in
`.ma/state/manager-runs.json` or the Maestro event log showing a successful
decision with `provider: "jev"`, its decision id, and the selected eligible
action. A failed request, missing key, timeout, malformed response, or merely
configured provider is not usage evidence.

When no such evidence exists, report: `provider use: not verified`. If the user
asks whether TypeSafe or Jev was used, inspect the persisted runtime evidence
first. If the user invoked `/maestro` inside a host without running the local
Maestro runtime, explain that the skill was loaded but no provider call was
verified; do not fill the gap with an assumption.

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
# `$maestro`

Maestro is the autonomous decision and verification loop. It does not replace or copy user skills. At intake it discovers project-local and user-global skill surfaces, ranks them against the task, and writes `.ma/context/skill-composition-plan.json`.

## Capability brokerage

- This brokerage is a required `$maestro` intake step. Every manager run must
  persist its `capabilityPlan` in `.ma/state/manager-runs.json` and the full
  plan in `.ma/context/skill-composition-plan.json` before lane selection.
- A task goal is enough; users do not need to name skills. Direct matches are
  preferred, then a bounded `ambient_fallback` selects readable project and
  user skills when the goal has no direct domain match. An empty goal selects
  no specialist capability and must be clarified by the task contract.
- Use the **Chai Discovery** cycle for capability selection: collect every readable
  project and user skill surface, classify each capability, rank it against the
  task intent, compose nested references in dependency order, and enforce the
  read-only boundary before dispatch. This is a Meta-Architect workflow name;
  it is not an external provider or dependency.
- Prefer project-local skills over global skills when the capability name is the same.
- Select only task-relevant skills; unrelated installed skills remain untouched.
- Compose referenced skills in dependency order when the host can load them.
- Before lane selection, load selected `SKILL.md` instructions in dependency order
  into a bounded, read-only execution packet and persist its receipt under
  `.ma/tasks/skill-execution-receipts/`.
- Treat that loaded instruction context as workflow input, never as build evidence.
- Do not mutate, copy, or claim ownership of third-party skill sources.
- Claim a skill was used only when the vendor surface returns a host receipt.

## Feedback loop

- Apply **Kaizen** to every bounded attempt: plan the capability set, run the
  owning lane, check fresh runtime evidence, and act on the failure by producing
  a rerouted plan. The cycle is persisted in `.ma/learning/skill-kaizen.ndjson`;
  it can improve the next attempt but cannot rewrite user skills, release state,
  source evidence, or security boundaries.

After each implementation step, use fresh tests, type checks, static checks, and runtime evidence. If verification fails, preserve the failure receipt, reroute the next bounded attempt toward the matching security, test, architecture, performance, or debugging capability, and retry only within the task contract. A passing generation without fresh execution evidence is not complete.

The broker and loader are the MA-owned instruction execution boundary. They do not
pretend that a vendor-native command was invoked: a vendor host receipt is still
required for a native execution claim.
