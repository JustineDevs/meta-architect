# Maestro Decision Core

Meta-Architect Maestro is an autonomous workflow controller. A user starts
Maestro once; Maestro reads the durable `.ma` state, computes safe eligible
actions, asks Jev to choose among those actions, dispatches the selected lane,
and records the decision. A user does not need to type the next lane command.

## Runtime contract

Live routing requires a TypeSafe API key in the process environment:

```bash
export TYPESAFE_API_KEY="jv_live_..."
ma run '$maestro'
```

Optional configuration:

```bash
export TYPESAFE_DEFAULT_MODEL="jev-latest"
export TYPESAFE_ENDPOINT="https://api.typesafe.ai/v1/systemone"
export TYPESAFE_TIMEOUT_MS="10000"
```

The key is read at runtime and is never written to `.ma`, receipts, logs, or
generated context. Jev receives only bounded routing state and typed Choice
criteria. It does not receive a free-form instruction asking it to execute
commands.

## Safety boundary

Local Meta-Architect code remains authoritative for:

- release-state prerequisites;
- lane ownership and artifact writes;
- command execution and approvals;
- malformed or unavailable provider handling;
- audit receipts and durable manager state.

Jev chooses one action from the locally eligible set. A response outside that
set, a malformed response, an HTTP error, or a timeout fails the Maestro run
closed. Jev cannot invent a lane, bypass a gate, or mutate release state.

## Explicit offline tests

The deterministic policy is retained only as an explicit test/offline provider:

```bash
MAESTRO_DECISION_PROVIDER=deterministic npm test
```

This mode is not the live default and is not a substitute for validating a
production Jev credential and endpoint.

## Persisted evidence

Each manager run records the provider, decision ID, selected action, confidence,
model, and eligible candidates in `.ma/state/manager-runs.json` and the Maestro
event log. This makes autonomous routing inspectable without persisting the API
key or raw authorization header.
