# Meta-Architect MCP server

This directory contains the hosted, read-only MCP server for Meta-Architect.
It is an MCP application project, not the CLI package or plugin bundle.

Production endpoint:

```text
https://ma.jstn.site/mcp
```

The server exposes two tools:

- `meta_architect_plan_next_action` — turn a bounded goal and verified evidence into the next safe workflow step.
- `meta_architect_get_guide` — return guidance for installation, setup, autonomous work, verification, or plugin hosting.

Neither tool accesses files, runs commands, changes repositories, publishes,
or deploys. Both advertise `readOnlyHint: true`, `destructiveHint: false`,
`idempotentHint: true`, and `openWorldHint: false`.

## Connect a client

Use the production URL directly; no project-local MCP wrapper is required.

### Codex

```bash
codex mcp add meta-architect --url https://ma.jstn.site/mcp
codex mcp list
```

### Claude Code

```bash
claude mcp add --transport http meta-architect https://ma.jstn.site/mcp
claude mcp list
```

Use `--scope user` with Claude Code for a user-wide registration, then run
`/mcp` to inspect the connection.

### Cursor, VS Code, and ChatGPT

Use each host's native MCP configuration with the production URL. ChatGPT
developer mode accepts the same URL in its MCP connection form.

These commands follow the official [Codex MCP setup
contract](https://developers.openai.com/learn/docs-mcp) and [Claude Code MCP
CLI contract](https://docs.anthropic.com/en/docs/claude-code/cli-usage).

## 🧩 Local development

First, run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000/mcp/inspector](http://localhost:3000/mcp/inspector)
to inspect the local server.

Edit [`index.ts`](./index.ts) to change tools, resources, or prompts. The
development server reloads as you edit.

Run the local checks before building:

```bash
npm run typecheck
npm run build
```

Statically declared tools used by MCP views must be assigned to exported
constants so generated view types remain valid.

## Deploy

```bash
npm run deploy
```

The deployed URL must remain HTTPS and expose the same read-only contract and
tool annotations described above. Verify the endpoint after deployment.

## Project files

<table>
  <tr><th>File</th><th>Purpose</th></tr>
  <tr><td><a href="./index.ts"><code>index.ts</code></a></td><td>MCP server entry point.</td></tr>
  <tr><td><a href="./chatgpt-app-submission.json"><code>chatgpt-app-submission.json</code></a></td><td>Hosted app submission metadata.</td></tr>
  <tr><td><a href="./public/"><code>public/</code></a></td><td>MCP app assets.</td></tr>
  <tr><td><a href="./package.json"><code>package.json</code></a></td><td>Local development and deployment scripts.</td></tr>
</table>

For the repository-level contract and release evidence, see the
[`docs/mcp-setup.md`](../../docs/mcp-setup.md) guide.

<div align="center">
  <h2>MCP resources</h2>
  <table>
    <tr>
      <td><a href="./index.ts">Server entry point</a></td>
      <td><a href="./chatgpt-app-submission.json">Submission metadata</a></td>
      <td><a href="https://mcp-use.com/docs/typescript/getting-started/quickstart">mcp-use guide</a></td>
    </tr>
  </table>
</div>

<div align="center">
  <h2>License</h2>
  <p><a href="../../LICENSE">MIT</a>. Built by <a href="https://github.com/JustineDevs">@JustineDevs</a>.</p>
</div>
