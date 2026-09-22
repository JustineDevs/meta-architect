# Autonomous tasks

Meta-Architect persists autonomous work in `.ma/tasks/autonomous-queue.json`.
The queue is separate from the team-run registry and is driven by the existing
Maestro manager.

## Intake

```bash
ma task add "Implement the parser" --priority high --label backend
ma task bulk tasks.json
cat tasks.yaml | ma task bulk - --format yaml
ma task list --json
```

For a task that is allowed to change source files, declare the workspace,
mutation mode, allowed paths, command argv, and verification argv explicitly:

```bash
ma task add "Update the parser" \
  --workspace "$PWD" \
  --mutation-mode source_write \
  --allow-path src \
  --command '{"file":"node","args":["scripts/update-parser.mjs"]}' \
  --verify '[{"file":"npm","args":["test","--","parser"]}]'
```

Commands are executed without a shell. The executor snapshots the Git
workspace before and after the command, rejects newly changed files outside
the declared paths, runs verification, and writes a receipt to
`.ma/tasks/execution-receipts/`. A task is not completed from a plan alone.

Each task receives a durable contract, status, retry budget, dependencies,
labels, optional deadline, selected environment capabilities, and evidence.
Duplicate IDs, malformed contracts, unknown dependencies, and dependency
cycles are rejected before persistence.

## Execution

```bash
ma task run --concurrency 3
ma task run --max-tasks 20 --json
ma task cancel task-123 "No longer needed"
```

Independent queued tasks run up to the configured concurrency. Dependencies
run first; failed, blocked, cancelled, expired, or unsafe tasks do not run
their downstream work. A failed task is retried up to `maxAttempts`, and the
queue remains resumable after interruption.

Environment discovery records installed project and user capabilities before
execution. Existing skills are observed rather than claimed or modified, and
vendor invocation metadata uses the environment's native `$`, `/`, or plain
command convention when a vendor is selected.

Every state transition emits a Maestro event under `.ma/events/` and persists
the latest queue atomically. Safe local work proceeds automatically; goals
that imply credentials, destructive changes, publication, production, or
other external mutations are blocked with an actionable reason.

Tasks with an explicit execution contract use the workspace executor for real
file changes. Tasks without one delegate to the Maestro manager for policy and
lane routing. Tests and host integrations can inject `execute(task)` into
`runAutonomousTasks` without changing the queue contract.
