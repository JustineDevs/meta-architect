# Real Demo Runbook

This runbook demonstrates Meta-Architect with real package functions, seeded workspace data, Obsidian vault context, `$maestro` routing, learning-loop readiness, Ralph handoff, and release proof.

Use it for live demos where the goal is to show MA handling an idea end-to-end instead of acting like a passive chatbot.

## Demo Objective

Show how a real workspace moves from a business idea to gated technical action:

1. Install MA.
2. Seed workspace context.
3. Give `$maestro` a realistic release-hardening goal.
4. Show MA selecting relevant lanes and preserving gate ownership.
5. Show Obsidian notes as graph-linked `vault_context`.
6. Show learning, context economy, environment awareness, Ralph handoff, and release verification.

## Pain Point Map

| Client objective | MA capability | Demo proof |
| --- | --- | --- |
| Stop late release surprises | `$maestro`, `$arch`, `$sage`, `$flow`, `$vet`, `$vibe`, `$build` | `.ma/plans/maestro.md`, `.ma/decisions.json`, `npm run release:verify` |
| Use existing knowledge without polluting build evidence | Obsidian Integration Core | vault notes indexed as `vault_context`, graph-linked with wikilinks |
| Make agent work reliable over time | Learning Loop, Environment Awareness, Context Economy, Ralph Execution Core | `npm run demo:smoke` JSON proof |

## Live Path

Install:

```bash
curl -fsSLo install.sh https://raw.githubusercontent.com/JustineDevs/meta-architect/v0.1.13/scripts/install.sh && curl -fsSLo install.sh.sha256 https://raw.githubusercontent.com/JustineDevs/meta-architect/v0.1.13/scripts/install.sh.sha256 && sha256sum -c install.sh.sha256 && sh install.sh
```

Fallback:

```bash
npm i -g @openai/codex@latest @jstn-sdk/ma@latest
ma --madmax --high
```

Source checkout path:

```bash
git clone https://github.com/JustineDevs/meta-architect.git
cd meta-architect
npm install
npm run demo:smoke
```

The smoke script creates a temporary Northstar Logistics workspace under `/tmp/ma-real-demo-*`, seeds a realistic Obsidian vault, runs MA runtime functions, and writes `.ma/evidence/real-demo-smoke-proof.json` inside that temporary workspace.

## Realistic Live Prompt

Use this inside Codex:

```text
$maestro Northstar Logistics wants to harden an existing dispatch analytics workspace for a production release. Inspect the repo, use Obsidian vault notes as brain context, choose the right MA roles, find risks, and produce the next release-safe action without asking for permission.
```

Expected behavior:

- `$maestro` records manager state instead of asking whether to proceed.
- `$arch` owns architecture direction.
- `$sage` owns evidence boundaries.
- `$flow` checks state and logic.
- `$vet` catches security and compliance risk.
- `$vibe` reviews DX/UX consequences.
- `$build` remains gated until upstream lanes allow execution.

## Obsidian Proof

The smoke vault includes:

- `Northstar/Dispatch Release Objective.md`
- `Northstar/Risk Register.md`
- `Meta-Architect/Core Brain Context.md`
- `Meta-Architect/Release Gate Plan.md`
- `Meta-Architect/Map of Content.md`

Expected claims:

- Notes record as `vault_context`.
- Notes do not record as `build_evidence`.
- MA notes use Obsidian wikilinks as semantic graph links.
- Authoritative changes return through `$maestro` or the owning lane.

## Backup Path

If the live environment fails:

```bash
npm run demo:smoke
npm run release:verify
```

Then show the generated JSON proof and the static runbook/story docs. This keeps the demo evidence real even when network, display, or Codex session conditions are unstable.

## Leave-Behind

Send these after the demo:

- [Demo Story](./DEMO_STORY.md)
- [Prospect Checklist](./PROSPECT_CHECKLIST.md)
- [Repository Demo Guide](../../DEMO.md)
- [Coverage Matrix](../../COVERAGE.md)
