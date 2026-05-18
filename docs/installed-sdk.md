# Installed Support Bundle

Meta-Architect installs two things into the active Codex home:

1. skills under `CODEX_HOME/skills/`
2. a support bundle under `CODEX_HOME/meta-architect-sdk/`

The support bundle exists so skills and helper paths can use relevant packaged files without guessing where they live.

The singular umbrella in-session skill is `maestro`. It is the bounded autonomous manager for the in-session workflow, and the installed skill set does not include a separate `meta-architect` skill folder.

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
- `mcp/native-playbooks.json`
- `mcp/local/playbooks.js`
- `sprint/`
- `prompts/`
- `scripts/`
- `plugins/meta-architect/`
- `templates/`
- `docs/README.md`
- `docs/reference/` when packaged native reference packs are present
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
- native playbooks manifest -> `meta-architect-sdk/mcp/native-playbooks.json`
- read-only playbooks capability module -> `meta-architect-sdk/mcp/local/playbooks.js`
- sprint references -> `meta-architect-sdk/sprint/`
- Codex prompt assets -> `meta-architect-sdk/prompts/`
- helper scripts -> `meta-architect-sdk/scripts/`
- plugin metadata -> `meta-architect-sdk/plugins/meta-architect/`
- templates -> `meta-architect-sdk/templates/`
- bundled reference packs -> `meta-architect-sdk/docs/reference/`

The in-session skill flow is still primary. This bundle only standardizes packaged asset access.

Surface split:
- in-session skills consume these packaged assets as product workflow inputs
- terminal helper commands may inspect or scaffold against the same bundle, but they remain secondary support tooling
- helper skills remain publishable and installable, but they do not own release-gate transitions

## Playbooks contract

`playbooks` is a first-party read-only local capability. Its packaged inputs live in the support bundle:

- `mcp/native-playbooks.json` is the repo-owned curation manifest
- `mcp/local/playbooks.js` is the packaged read-only resource surface
- `docs/reference/` is where bundled native reference packs land when the release includes them

Readiness should treat those assets as package-owned bundle contents, not as repo-local user setup steps or upstream mirrors.
