# Onboarding

This is the shortest operator entrypoint for someone who just opened Meta-Architect and needs the real first-run path.

## Read first

1. `README.md`
2. `docs/getting-started.md`
3. `example/usage-workflow.md`
4. `docs/release-spec.md`
5. `docs/skills-publishing.md`

## Canonical install and launch

```bash
npm i -g @openai/codex@latest meta-architect@latest
ma --madmax --high
```

## First runtime action

Start with the structured `$arch` prompt from [example/usage-workflow.md](../example/usage-workflow.md):

```text
$arch I want to build: [PROJECT IDEA]
```

Then continue through:
- `$sage`
- `$flow`
- `$vet`
- `$vibe`
- `$build`

## Secondary helper path

Only use this when you need local repo scaffolding or scripted validation:

```bash
ma setup
ma
ma idea "..."
ma run '$arch'
ma run '$sage'
ma run '$flow'
ma run '$vet'
ma run '$vibe'
ma run '$build'
```

## First safety rules

- Do not commit runtime `.ma` state.
- Do not bypass gates by editing status files manually.
- Do not assume a release channel succeeded without evidence.
- Do not treat fallback MCP docs mode as normal verified evidence.
