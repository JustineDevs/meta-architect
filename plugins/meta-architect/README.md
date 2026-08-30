# Meta-Architect Plugin Bundle

This plugin bundle packages the Meta-Architect skill surfaces for consumers that want an installable plugin-style distribution instead of working directly from the source repository.

## What the plugin contains

- plugin metadata:
  - `.codex-plugin/plugin.json`
  - `.app.json`
  - `.mcp.json`
- bundled Meta-Architect skill surfaces under `skills/`
- one umbrella autonomous manager: `$maestro`
- fixed gated lanes: `$arch`, `$sage`, `$flow`, `$vet`, `$vibe`, `$build`
- non-gating helper skills: `$align`, `$diagnose`, `$tdd`, `$cleanup`
- packaged native reference files mirrored under the relevant skill folders
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

### Claude Code marketplace

This repository is the hosted marketplace. In Claude Code, add it and install the existing plugin:

```text
/plugin marketplace add JustineDevs/meta-architect
/plugin install meta-architect@meta-architect
```

The same plugin can be tested locally with `claude --plugin-dir ./plugins/meta-architect`.

Recommended CLI install for macOS, Linux, WSL, and Git-Bash:

```bash
# One-line install (POSIX shells only; use WSL/Git-Bash on Windows)
curl -fsSLo install.sh https://cdn.jsdelivr.net/gh/JustineDevs/meta-architect@latest/scripts/install.sh && curl -fsSLo install.sh.sha256 https://cdn.jsdelivr.net/gh/JustineDevs/meta-architect@latest/scripts/install.sh.sha256 && sed 's#scripts/install.sh#install.sh#' install.sh.sha256 | sha256sum -c - && sh install.sh
```

Canonical package/runtime path:

Debian-family install:

```bash
sudo apt install ./meta-architect_<version>_all.deb
```

Arch-family install:

```bash
sudo pacman -U ./meta-architect-<version>-1-any.pkg.tar.xz
```

Fedora/openSUSE install:

```bash
sudo dnf install ./meta-architect-<version>-1.noarch.rpm
```

npm fallback/default supported path:

```bash
# Install
npm i -g @openai/codex@latest @jstn-sdk/ma@latest

# Launch
ma --madmax --high

# Remove Meta-Architect only
npm uninstall -g @jstn-sdk/ma

# Remove Meta-Architect and Codex
npm uninstall -g @jstn-sdk/ma @openai/codex
```

Use the plugin bundle when you need installable skill metadata or local marketplace discovery. Use the package and Codex skill flow when you want the full Meta-Architect product experience.

Primary related surfaces:
- [docs/skills-publishing.md](../../docs/skills-publishing.md)
- [skills/](../../skills/)

If you are working from the repository directly, validate and package with:

```bash
npm run skills:manifest
npm run plugin:sync
npm run skills:validate
npm run plugin:verify
npm run skills:pack
npm run skills:install -- --path ./dist/installed-skills
```

Consumer expectation:
- the plugin ships the same public skill contracts as the canonical `skills/` directory
- `$maestro` remains the only umbrella surface in the plugin bundle and acts as the bounded autonomous manager for the in-session workflow
- helper skills are installable mirrors, but they remain non-gating and do not create new release gates
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
- plugin scope is aligned to Meta-Architect `v0.14.1`
- any breaking contract change should be versioned intentionally

The plugin is one distribution surface of the same product, not a separate product line.

## Related surfaces

- [README.md](../../README.md)
- [docs/skills.md](../../docs/skills.md)
- [docs/skills-publishing.md](../../docs/skills-publishing.md)
- [docs/mcp-setup.md](../../docs/mcp-setup.md)
- [.app.json](./.app.json)
- [.codex-plugin/plugin.json](./.codex-plugin/plugin.json)
- [.claude-plugin/plugin.json](./.claude-plugin/plugin.json)
- [.mcp.json](./.mcp.json)
