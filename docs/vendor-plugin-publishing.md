# Vendor Plugin Publishing

The existing `plugins/meta-architect` directory is the only hand-authored plugin source. Build vendor outputs from it:

```bash
npm run plugin:build -- --targets all --output ./dist/vendor-plugins
```

Publishing is explicit and one host at a time. It is a dry run unless `--execute` is supplied:

```bash
npm run plugin:publish -- --target pi
```

Pi consumes the existing `@jstn-sdk/ma` package; no second npm package is created. Claude Code, Cursor, Antigravity, Gemini CLI, OpenCode, Cline, Continue, Goose, and OpenClaw use host-specific Git, marketplace, extension, or workspace distribution flows; `plugin:publish` prepares those native inputs and does not pretend a local npm command publishes them.

The builder produces one directory per host. It copies the existing lane skills and adds only the host manifest, rules, context file, or package metadata required by that host. It never creates a second workflow or changes the canonical skills.

ChatGPT is not included as a generated local plugin target. ChatGPT
publication requires a deployed HTTPS MCP backend, authentication, privacy
materials, and OpenAI review. See [ChatGPT Integration](./chatgpt-integration.md)
for the exact readiness contract.

## Outputs

| Target | Output | Mode |
| --- | --- | --- |
| `codex` | `.codex-plugin/`, `skills/`, app and MCP metadata | native |
| `claude-code` | Claude marketplace plus plugin source | native |
| `cursor` | Cursor marketplace plus plugin source and rules | native |
| `antigravity` | `plugin.json`, `skills/`, `rules/` | native |
| `gemini-cli` | `gemini-extension.json`, `GEMINI.md`, `skills/` | native |
| `opencode` | `.opencode/skills/`, `AGENTS.md` | native |
| `pi` | `@jstn-sdk/ma` package with `pi.skills` metadata | native |
| `cline` | `.clinerules`, `.cline/skills/` | native |
| `openclaw` | workspace `skills/` and `AGENTS.md` | portable |
| `continue` | `.continue/rules/` and portable skills | portable |
| `goose` | workspace `skills/` and `AGENTS.md` | portable |

Portable means the generated bundle is usable as project context and skills, but this repository does not invent a host runtime plugin or claim marketplace publication. A host-specific publisher still requires the host account, repository, or review process.

## Verification

```bash
npm test -- test/plugin-build.test.js
npm run plugin:verify
```

Inspect `BUILD-MANIFEST.json` in each output before publishing. It records the generated version, source, support mode, and the host-specific install/publish action.
