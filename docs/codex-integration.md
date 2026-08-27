# Codex integration

Meta-Architect drives the installed Codex binary; it does not reproduce Codex's TUI or runtime.

`CodexAppServerClient` uses the real stdio JSON-RPC app-server lifecycle: initialize, thread start/resume/fork/list/archive, turn start/interrupt, configuration read/write, and streamed notifications. `runCodexExec()` uses `codex exec --json` for bounded automation, and `generateCodexBindings()` delegates type/schema generation to the running Codex binary.

All child processes use argument arrays with `shell: false`, time out, and surface non-zero exits. Goal support remains Codex-owned: prompts may request the installed `create_goal`, `get_goal`, and `update_goal` tools, while Meta-Architect only consumes the resulting notifications.

```js
import { CodexAppServerClient } from "@jstn-sdk/ma";

const codex = new CodexAppServerClient();
await codex.initialize();
const thread = await codex.startThread({ ephemeral: true });
await codex.startTurn({ threadId: thread.id, input: [{ type: "text", text: "Run the quality gate" }] });
```
