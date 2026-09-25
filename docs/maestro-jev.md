# Maestro Decision Core

Meta-Architect Maestro is an autonomous workflow controller. When the local
Maestro runtime is started with its live provider configured, a user starts
Maestro once; it reads the durable `.ma` state, computes safe eligible actions,
asks Jev to choose among those actions, dispatches the selected lane, and
records the decision. A user does not need to type the next lane command.

Loading the in-session `$maestro` skill in an AI host is not a provider call. If
the host did not run the local Maestro runtime, provider use is **not verified**
and must not be inferred from an API key, package, or prompt.

## Runtime contract

Live routing requires a TypeSafe API key. Configure it once for the current
user:

```bash
ma auth typesafe
ma run '$maestro'
```

The key is stored in the owner-only dotenv-compatible file
`~/.config/meta-architect/provider.env`. Project `.env.local` and `.env` files
are also supported. Precedence is explicit environment variables, `.env.local`,
`.env`, then the global provider file. Use `ma auth typesafe --status` to check
configuration without printing the key.

The model is selected automatically as `jev-latest`. No model configuration is
required. Advanced deployments may override the endpoint, model, or timeout:

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

Run the real provider smoke test after global or project dotenv configuration:

```bash
npm run test:maestro-live
```

This performs one bounded Jev decision request and exits non-zero when the
provider is unavailable or returns an invalid lane. The regular test suite
remains deterministic so it is reproducible without credentials.

## Persisted evidence

Each successful manager run records the provider, decision ID, selected action,
confidence, model, and eligible candidates in `.ma/state/manager-runs.json` and
the Maestro event log. Failed requests record the requested provider and
`provider_used: false`; they are not evidence of a provider decision. This
makes autonomous routing inspectable without persisting the API key or raw
authorization header.
