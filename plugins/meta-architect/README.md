# Meta-Architect Plugin Bundle

This plugin bundle packages the Meta-Architect skill surfaces for consumers that want an installable plugin-style distribution instead of working directly from the source repository.

## What the plugin contains

- plugin metadata:
  - `.app.json`
  - `.mcp.json`
- bundled Meta-Architect skill surfaces under `skills/`
- a release-scoped version line aligned to the repo

## What the plugin does not contain

This plugin is **not** the full source repository.

It does not attempt to ship:
- repository `.github/` workflows
- contributor-facing repo templates
- local runtime `.ma` state
- every source file in the repository
- the entire release engineering toolchain

It is an installable skill bundle, not a complete clone of the repo.

## How it differs from core repo source

Core repo source contains:
- implementation code
- packaging scripts
- CI/release workflows
- contributor docs
- missions
- templates

Plugin bundle contains:
- the installable skill-facing product layer
- plugin metadata that describes the bundle to consumers

Use the core repo when you want to develop Meta-Architect itself. Use the plugin bundle when you want to consume the packaged skill surface.

## Install and use

The plugin-facing bundle should be consumed alongside the repository’s documented packaging/install flow.

Primary related surfaces:
- [docs/skills-publishing.md](../../docs/skills-publishing.md)
- [skills/](../../skills/)

If you are working from the repository directly, validate and package with:

```bash
npm run skills:manifest
npm run skills:validate
npm run skills:pack
npm run skills:install -- --path ./dist/installed-skills
```

Consumer expectation:
- the plugin ships the same public skill contracts as the canonical `skills/` directory
- it does not define a looser or simplified product contract

## MCP wiring expectations

The plugin metadata in `.mcp.json` is only a starting point.

Consumers are expected to:
- replace placeholder or generic collection notes with real repo-specific GitMCP endpoints
- align MCP wiring with their own environment
- preserve the same evidence policy used by the core repo

Do not assume the plugin alone provides a fully wired live MCP environment.

## Safe consumer guidance

When consuming the plugin:
- use committed `skills/` content as the contract source
- validate installed skill folders
- do not treat local runtime `.ma` state as part of the distributable plugin
- preserve the gate/evidence semantics documented in the repo

## Version and release relation

The plugin version should track the release scope of the core repo.

For this repository:
- plugin scope is aligned to Meta-Architect `v0.1.0`
- any breaking contract change should be versioned intentionally

The plugin is one distribution surface of the same product, not a separate product line.

## Related surfaces

- [README.md](../../README.md)
- [docs/skills.md](../../docs/skills.md)
- [docs/skills-publishing.md](../../docs/skills-publishing.md)
- [docs/mcp-setup.md](../../docs/mcp-setup.md)
- [.app.json](./.app.json)
- [.mcp.json](./.mcp.json)
