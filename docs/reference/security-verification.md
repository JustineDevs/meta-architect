# Security verification dossier

`$vet` uses OWASP ASVS as the default verification baseline for web apps, APIs,
plugins, and hosted MCP surfaces. It is a control-verification baseline, not a
complete threat model or a substitute for product-specific risk analysis.

## Default review

For each material boundary, map the threat-model finding to a verifiable control,
record the applicable ASVS requirement or section, and name the test or evidence
that proves it. Review authentication, authorization, input handling, secrets,
logging, dependency exposure, privacy, and failure disclosure. Keep blockers
separate from accepted risks and never infer security from a `read-only` label.

For package, build, and release paths, `$vet` also checks the SLSA dossier for
provenance and artifact integrity concerns. It does not claim an SLSA level
without matching evidence.

## Reference sources

- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/),
  pinned to commit `2b300716ebbef654788d0a14d6c878cecc70c2e9` through
  `https://gitmcp.io/OWASP/ASVS`.
- [SLSA specification](https://slsa.dev/spec/v1.2/), pinned to commit
  `618f5b2192aad8417a8ee8ccb9e3f27d05c0e9b6` through
  `https://gitmcp.io/slsa-framework/slsa`.

Credit belongs to OWASP and the SLSA community. Confirm the applicable version,
license, and requirement text from the pinned source before publishing a receipt.
