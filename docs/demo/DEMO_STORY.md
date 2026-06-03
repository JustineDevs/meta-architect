# Demo Story

## Narrative

Northstar Logistics has an existing dispatch analytics workspace. The team wants a production release, but their current process has three recurring failures:

- release gates are discovered too late
- operational knowledge is trapped in notes
- autonomous agents ask for permission instead of driving safe next steps

Meta-Architect enters as the operating layer that gives the buyer a controlled path from idea to verified action.

## Opening

Set expectations:

> I am going to give MA one realistic release goal. The important part is not that it prints a plan. The important part is that it routes work through the right roles, keeps Obsidian notes as brain context, protects evidence boundaries, and produces proof we can inspect.

## Act 1: The Idea

Prompt:

```text
$maestro Northstar Logistics wants to harden an existing dispatch analytics workspace for a production release. Inspect the repo, use Obsidian vault notes as brain context, choose the right MA roles, find risks, and produce the next release-safe action without asking for permission.
```

Business outcome:

- The buyer sees one entry point instead of deciding which agent or role should act.
- MA does not behave like a passive chatbot.

## Act 2: The Brain Context

Show Obsidian notes:

- `Northstar/Dispatch Release Objective.md`
- `Northstar/Risk Register.md`
- `Meta-Architect/Map of Content.md`

Business outcome:

- Existing team knowledge becomes usable without becoming fake build evidence.
- Wikilinks make the context navigable and explainable.

## Act 3: The Gates

Show:

- `.ma/decisions.json`
- `.ma/plans/maestro.md`
- `.ma/state/maestro-state.json`

Business outcome:

- Architecture, evidence, logic, security, DX, and build readiness remain separate.
- The buyer can audit why MA did or did not allow execution.

## Act 4: Reliability Over Time

Run:

```bash
npm run demo:smoke
```

Business outcome:

- MA proves learning-loop readiness, context economy, environment awareness, Ralph execution handoff, and Obsidian integration through a repeatable smoke.

## Close

End with:

```bash
npm run release:verify
```

Business outcome:

- The demo closes on a deterministic production gate, not a subjective impression.
