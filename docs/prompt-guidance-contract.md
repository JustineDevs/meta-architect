# Prompt Guidance Contract

Meta-Architect prompt surfaces must preserve the Active Autonomy Core contract.

## Required Patterns

1. `AUTO-CONTINUE` and `ASK` must be named explicitly.
2. The `ASK` list is closed: destructive, irreversible, credential-gated, external-production, materially scope-changing, or missing authority.
3. Permission-handoff phrasing is banned on AUTO-CONTINUE branches.
4. Skills and role prompts must describe completion as a loop with explicit stop conditions.
5. Workflow terminal replies must name an outcome: `finished`, `blocked`, `failed`, `cancelled`, or `askuserQuestion`.
6. Completion claims require fresh verification evidence or an explicit validation gap.
7. Runtime hook policy must include stall-pattern coverage for passive permission handoffs.

## Contributor Rule

Do not weaken the anti-passive contract when editing prompts, skills, hooks, or exported host payloads. If a prompt surface cannot execute safely, it must name the exact closed-list ASK reason instead of asking a vague permission question.
