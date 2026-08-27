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
curl -fsSLo install.sh https://raw.githubusercontent.com/JustineDevs/meta-architect/v0.14.0/scripts/install.sh && curl -fsSLo install.sh.sha256 https://raw.githubusercontent.com/JustineDevs/meta-architect/v0.14.0/scripts/install.sh.sha256 && sha256sum -c install.sh.sha256 && sh install.sh
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

After setup, `ma welcome` reprints the bounded project summary, active integration
states, context locations, and safe next commands. It never includes vault paths,
tokens, or machine-specific runtime receipts.

Npm authentication is also temporary by design. Setup and release helpers use
`NODE_AUTH_TOKEN` or a generated owner-only npm config outside the repository;
they must not create a workspace `.npmrc` containing credentials. `ma doctor`
warns when a token-bearing workspace `.npmrc` is found. Callers that create a
temporary config must remove it with `cleanupTemporaryNpmConfig` after the npm
operation completes.

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
ma idea "Prepare Meta-Architect v0.14.0 for a production package release with real install docs, Obsidian brain-context support, learning-loop reliability, and package proof artifacts."
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
