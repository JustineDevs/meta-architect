# Codex integration

Meta-Architect drives the installed Codex binary; it does not reproduce Codex's TUI or runtime.

`CodexAppServerClient` uses the real stdio JSON-RPC app-server lifecycle: initialize, thread start/resume/fork/list/archive, turn start/interrupt, configuration read/write, and streamed notifications. `runCodexExec()` uses `codex exec --json` for bounded automation, and `generateCodexBindings()` delegates type/schema generation to the running Codex binary.

All child processes use argument arrays with `shell: false`, time out, and surface non-zero exits. Goal support remains Codex-owned: prompts may request the installed `create_goal`, `get_goal`, and `update_goal` tools, while Meta-Architect only consumes the resulting notifications.

## Capability discovery and selection

Maestro discovers the capabilities of the Codex binary installed on the machine before composing a task. It reads the real CLI help, version, feature flags, MCP servers, plugins, diagnostics, and the app-server methods supported by the MA client. The result is written to `.ma/context/codex-capability-inventory.json` and is available to Maestro as bounded selection context.

```sh
ma codex inventory --json
ma codex inventory --select "recap the current task and inspect MCP tools"
```

Discovery is not execution. The inventory marks capabilities as available or disabled, and selection only reports what Maestro may use. It does not mutate Codex configuration, treat installed skills or plugins as completed work, or turn capability availability into build evidence.

Some Codex features are prompt-routed rather than standalone subcommands. For example, `recap` is represented as `session.recap`, backed by the installed `codex exec --json` surface, with `direct_cli_subcommand: false`. This keeps the user-facing capability useful while preserving an accurate distinction between native commands, feature flags, MCP servers, plugins, app-server methods, and prompt capabilities.

```js
import { CodexAppServerClient } from "@jstn-sdk/ma";

const codex = new CodexAppServerClient();
await codex.initialize();
const thread = await codex.startThread({ ephemeral: true });
await codex.startTurn({ threadId: thread.id, input: [{ type: "text", text: "Run the quality gate" }] });
```
