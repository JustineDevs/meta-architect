---
name: maestro
description: "Use when the user wants Meta-Architect to choose the best next workflow step, explain why, and recommend the right lane or assignment."
---

# Maestro

Use this skill inside Codex when you want Meta-Architect to act like a workflow manager.

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
- Respect current gate state before recommending implementation or release work.
- Be explicit when more evidence, planning, or validation is still needed.
- Route to the in-session skill flow first; use helper commands only when they are the clearest support path.
