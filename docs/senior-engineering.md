# Senior Engineering Execution

Meta-Architect treats every task as an evidence-backed engineering change. The runtime writes the execution contract to `.ma/context/engineering-policy.json` and attaches a plan to each durable task.

## Priority before implementation

Every task is classified before mutation:

| Priority | Meaning | Default response |
| --- | --- | --- |
| P0 | Blocker, outage, security incident, data loss, or release-critical failure | Contain first, then repair with explicit rollback evidence |
| P1 | Core requirement needed for the requested outcome | Design and implement in the current delivery |
| P2 | Important quality, reliability, performance, or maintainability work | Include when it is bounded; otherwise record the deferral |
| P3 | Polish or non-urgent improvement | Keep out of the critical path unless it is nearly free |

An explicit priority wins over keyword classification. If no priority is supplied, Meta-Architect uses the task goal and risk to assign one and records the result in the task contract.

## Execution blueprint

The default sequence is:

1. **Understand**: inspect the request, repository state, constraints, risks, and affected boundaries. Ask only questions that change the decision.
2. **Design**: define the smallest viable change, contracts, dependencies, edge cases, and rollback path before mutation.
3. **Trim**: remove unrelated scope, reuse existing utilities, and keep the change reviewable.
4. **Guardrails**: run focused tests, static checks, security checks, and observable evidence for the changed behavior.
5. **Rollout**: use preview, canary, or another contained channel where applicable; monitor the result and record promotion or rollback evidence.

## Completion contract

A task is complete only when the implementation exists, required tests and checks pass, generated artifacts validate, receipts are persisted, and no unresolved blocker remains. External mutations, destructive actions, credentials, and production promotion remain explicit approval boundaries.

The policy is inspectable through `ma status --json` and the durable task queue. It is seeded during setup and is not a hidden model instruction.
