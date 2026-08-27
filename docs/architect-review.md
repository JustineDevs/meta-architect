# External architect review

External review is disabled unless `MA_ARCHITECT_REVIEW_CMD` is configured.
The executable must also be allowlisted with
`MA_ARCHITECT_REVIEW_ALLOWLIST`, or in `.ma/architect-review-policy.json`:

```json
{"allowedCommands":["/usr/local/bin/architect-review"]}
```

Meta-Architect executes argv directly with no shell, passes only the minimal
runtime environment, bounds execution to two minutes, limits output to 1 MiB,
and redacts prompts, reviewer output, and failure diagnostics. Lifecycle
receipts are written to `.ma/evidence/architect-review-receipts/`.
