# Onboarding

This is the shortest entrypoint for the real first-run Meta-Architect path.

## Read first

1. `README.md`
2. `docs/getting-started.md`
3. `example/usage-workflow.md`
4. `docs/release-spec.md`
5. `docs/skills-publishing.md`

## Canonical install and start

Recommended CLI install for macOS, Linux, WSL, and Git-Bash:

```bash
# One-line install (POSIX shells only; use WSL/Git-Bash on Windows)
curl -fsSL https://cdn.jsdelivr.net/gh/JustineDevs/meta-architect@main/scripts/install.sh | sh
```

The installer uses jsDelivr to fetch this repo's POSIX install script and runs the canonical npm install path.

```bash
# Install
npm i -g @openai/codex@latest @jstn-sdk/ma@latest

# Start Codex context if needed
ma --madmax --high

# Remove Meta-Architect only
npm uninstall -g @jstn-sdk/ma

# Remove Meta-Architect and Codex
npm uninstall -g @jstn-sdk/ma @openai/codex
```

## First runtime action

Start with `$maestro` when you want MA to choose and drive the next safe lane:

```text
$maestro
```

Use the structured `$arch` prompt from [example/usage-workflow.md](../example/usage-workflow.md) when you already know the project brief and want to begin directly with architecture:

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
ma idea "Prepare Meta-Architect v0.1.13 for a production package release with real install docs, Obsidian brain-context support, learning-loop reliability, and package proof artifacts."
ma run '$maestro'
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
