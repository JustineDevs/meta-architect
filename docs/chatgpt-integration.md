# ChatGPT Desktop and Work Integration

Meta-Architect has two distinct OpenAI surfaces:

1. A portable, skills-only plugin that ChatGPT Desktop and Codex can discover
   from a local marketplace.
2. The local `ma` runtime and Jev-backed Maestro execution, which require a
   local Codex/Node environment or a separately deployed MCP app.

Do not use a direct filesystem link such as:

```text
[$maestro](/home/justine/.codex/skills/maestro/SKILL.md)
```

That path is meaningful only to the local Codex CLI filesystem. ChatGPT
Desktop resolves installed plugin copies through a marketplace and does not
load arbitrary absolute skill paths from chat messages.

## ChatGPT Desktop installation

The repository contains the repo marketplace at
`.agents/plugins/marketplace.json` and the portable plugin at
`plugins/meta-architect/`.

From the repository root, validate the package:

```bash
npm run plugin:validate
```

Then add or refresh the local marketplace through Codex:

```bash
codex plugin marketplace add ./
codex plugin marketplace list
```

Restart ChatGPT Desktop. Open Plugins, choose the local Meta-Architect
marketplace, and install **Meta-Architect**. The app installs a copy into its
plugin cache; it does not depend on `/home/justine/.codex/skills/maestro/`.

The generated portable artifact can be inspected with:

```bash
npm run plugin:build -- --target chatgpt-desktop --output ./dist/vendor-plugins
```

The resulting directory contains a root `plugin.json` and `skills/` directory.
It can be uploaded as a plugin ZIP when the workspace provides plugin upload
access.

## Invocation

In ChatGPT Desktop, select the installed plugin or use its available `@`
mention, then ask in normal language:

```text
Use Meta-Architect Maestro to choose the next safe workflow step for this task.
```

In Codex CLI, install the local skill package and invoke:

```text
$maestro I want to build: [your project goal]
```

Do not paste an absolute `SKILL.md` path into ChatGPT. The validation command
also reports the supported installation path:

```bash
npm run plugin:validate -- --invocation '[$maestro](/absolute/path/SKILL.md)'
```

## Runtime and permissions

The Desktop plugin is a portable instruction surface. It can guide the
workflow, but installing a skill does not grant local shell access, local
repository access, or permission to run the `ma` binary.

For live Maestro execution with Jev, use the local Codex/Node installation:

```bash
npm i -g @jstn-sdk/ma@latest
ma auth typesafe
ma run '$maestro'
```

For ChatGPT Work or hosted execution, expose only the bounded capabilities
through a separately deployed, authenticated HTTPS MCP app. A local MCP
server is not directly reachable by ChatGPT; use a supported secure tunnel or
deploy the service. Never expose local paths, raw secrets, workspace
credentials, or unbounded shell execution.

## Current compatibility matrix

| Surface | Skill discovery | Live local Maestro runtime |
| --- | --- | --- |
| Codex CLI | Local skill install or package | Supported with Node and Jev credentials |
| ChatGPT Desktop local plugin | Repo marketplace or plugin upload | Not provided by the skills-only plugin |
| ChatGPT Work hosted plugin | Workspace install or upload | Requires a deployed MCP app and workspace permissions |

This repository does not claim hosted ChatGPT runtime compatibility until an
MCP app is deployed, authenticated, reviewed, and tested independently.

## Official OpenAI references

- [Package your plugin](https://developers.openai.com/plugins/build/plugins)
- [Plugins in ChatGPT and Codex](https://help.openai.com/en/articles/20001256-plugins-in-chatgpt-and-codex)
- [Skills in ChatGPT](https://help.openai.com/en/articles/20001066-skills-in-chatgpt)
- [Developer mode and MCP apps](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt)
