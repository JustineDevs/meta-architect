# Installed Support Bundle

Meta-Architect installs two things into the active Codex home:

1. skills under `CODEX_HOME/skills/`
2. a support bundle under `CODEX_HOME/meta-architect-sdk/`

The support bundle exists so skills and helper paths can use relevant packaged files without guessing where they live.

## Canonical support bundle path

Default:

```text
~/.codex/meta-architect-sdk/
```

If `CODEX_HOME` is set, use:

```text
$CODEX_HOME/meta-architect-sdk/
```

You can print the exact active path with:

```bash
ma sdk-path
```

## What is installed there

- `mcp/`
- `sprint/`
- `prompts/`
- `scripts/`
- `plugins/meta-architect/`
- `templates/`
- `docs/README.md`
- `asset-manifest.json`

## Why this exists

- skills can rely on a standard installed asset root
- helper paths can repair missing support assets automatically
- packaged references do not depend on a source checkout
- the product can use relevant packaged files without path guessing

## Contract

When Meta-Architect needs packaged support files, prefer the installed support bundle first.

Examples:
- MCP starter files -> `meta-architect-sdk/mcp/`
- sprint references -> `meta-architect-sdk/sprint/`
- Codex prompt assets -> `meta-architect-sdk/prompts/`
- helper scripts -> `meta-architect-sdk/scripts/`
- plugin metadata -> `meta-architect-sdk/plugins/meta-architect/`
- templates -> `meta-architect-sdk/templates/`

The in-session skill flow is still primary. This bundle only standardizes packaged asset access.
