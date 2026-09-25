# Live regression workflow

`npm test` is intentionally deterministic. Release candidates also need a real
provider and a real workspace mutation path. `npm run live:regression` exercises
that boundary in an isolated temporary Git repository:

1. Seeds and commits a clean project.
2. Runs `ma setup --json` and `ma doctor --json`.
3. Routes `$maestro` through the live Jev provider.
4. Intakes an autonomous task with an explicit source-write boundary.
5. Executes the task and its verification command without a shell.
6. Checks the generated source artifact and execution receipt.
7. Captures provider, stages, assertions, and receipt results in a redacted JSON
   evidence file.
8. Removes the temporary workspace before the process exits.

Run locally after configuring a user-scoped credential with `ma auth typesafe`
or a project `.env.local` file:

```bash
npm run live:regression
```

For CI, set the repository secret as `TYPESAFE_API_KEY` and pass it to the
workflow process. Explicit environment variables continue to override dotenv
and global configuration.

The output defaults to `docs/qa/live-regression-<package-version>.json`. Use
`--output <path>` for CI or a separate evidence location. The workflow is also
available through GitHub Actions manually and on version tags. It requires the
repository secret `TYPESAFE_API_KEY`; it never writes that value to evidence.

The workflow proves the live provider and the local execution boundary. It does
not claim that every vendor host is runtime-verified; vendor evidence remains
separated in the conformance matrix.
