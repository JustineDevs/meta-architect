# Meta-Architect Plugin Bundle

This directory is the installable Meta-Architect plugin surface. It packages
the skills and plugin metadata needed by supported agent hosts. It is not the
repository README, CLI runtime, or MCP server documentation.

Current release line: `v0.15.3` · package: `@jstn-sdk/ma@0.15.3`

## What this plugin contains

- plugin metadata:
  - `.codex-plugin/plugin.json`
  - `.app.json`
  - `.mcp.json`
- bundled Meta-Architect skill surfaces under `skills/`
- one umbrella autonomous manager: `$maestro`
- fixed gated lanes: `$arch`, `$sage`, `$flow`, `$vet`, `$vibe`, `$build`
- non-gating helper skills: `$align`, `$diagnose`, `$tdd`, `$cleanup`
- the bundled MCP metadata in [`.mcp.json`](./.mcp.json)

The plugin version follows the repository release line. The current release is
`v0.15.3`.

## What this plugin does not contain

This plugin is **not** the full source repository.

The plugin does not include the full Meta-Architect source repository, the
local `.ma/` runtime state, provider credentials, CI workflows, or release
automation. Use the repository package for the CLI runtime and the MCP server
project for hosted MCP behavior.

<a id="setup"></a>

## 🧩 Setup

### ChatGPT Desktop local marketplace

This bundle uses the portable Agent Plugins format. It has plugin metadata and
a `skills/` directory, so supported hosts can discover its skill surfaces.

From the repository root:

```bash
npm run plugin:validate
codex plugin marketplace add ./
```

Restart ChatGPT Desktop, open Plugins, select the local Meta-Architect
marketplace, and install **Meta-Architect**. Then ask the installed plugin to
use Maestro in normal language. The canonical skill source is the
[remote GitHub `$maestro` skill](https://github.com/JustineDevs/meta-architect/blob/main/plugins/meta-architect/skills/maestro/SKILL.md);
do not paste local filesystem paths into ChatGPT.

Build an uploadable portable artifact with:

```bash
npm run plugin:build -- --target chatgpt-desktop --output ./dist/vendor-plugins
```

This local plugin loads the skill instructions. Live Jev-backed Maestro
execution still requires the local `ma` runtime or a separately deployed,
authenticated MCP app.

### Claude Code marketplace

This repository is the hosted marketplace. In Claude Code, add it and install the existing plugin:

```text
/plugin marketplace add JustineDevs/meta-architect
/plugin install meta-architect@meta-architect
```

The same plugin can be tested locally with `claude --plugin-dir ./plugins/meta-architect`.

If you are maintaining the plugin from the repository, validate and package
with:

```bash
npm run skills:manifest
npm run plugin:sync
npm run skills:validate
npm run plugin:verify
npm run skills:pack
npm run skills:install -- --path ./dist/installed-skills
```

Consumer expectation:
- the plugin ships the public skill contracts from the bundled `skills/` directory
- `$maestro` remains the umbrella workflow surface
- helper skills remain non-gating
- host configuration and credentials remain user-owned

## Plugin resources

<table>
  <tr><th>Manifest</th><th>Manifest</th></tr>
  <tr><td><a href="./.app.json">.app.json</a></td><td><a href="./.codex-plugin/plugin.json">Codex manifest</a></td></tr>
  <tr><td><a href="./.claude-plugin/plugin.json">Claude manifest</a></td><td><a href="./.mcp.json">MCP metadata</a></td></tr>
</table>

<div align="center">
  <h2>Plugin resources</h2>
  <table>
    <tr>
      <td><a href="../../docs/getting-started.md">Getting started</a></td>
      <td><a href="../../docs/skills.md">Skills reference</a></td>
      <td><a href="../../docs/skills-publishing.md">Skills publishing</a></td>
    </tr>
    <tr>
      <td><a href="../../docs/mcp-setup.md">MCP setup</a></td>
      <td><a href="../../docs/chatgpt-integration.md">ChatGPT integration</a></td>
      <td><a href="../../docs/release-spec.md">Release spec</a></td>
    </tr>
    <tr>
      <td><a href="../../SECURITY.md">Security reporting</a></td>
      <td><a href="../../docs/ossf-best-practices.md">OpenSSF evidence</a></td>
      <td><a href="../../CONTRIBUTING.md">Contributing</a></td>
    </tr>
  </table>
</div>

<div align="center">
  <h2>License</h2>
  <p><a href="../../LICENSE">MIT</a>. Built by <a href="https://github.com/JustineDevs">@JustineDevs</a>.</p>
</div>
