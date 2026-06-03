# Native Security Playbooks

Security-oriented external patterns are absorbed into Meta-Architect as `$vet` guidance and packaged playbooks.

## Review slices

- identity and session boundaries
- authorization and tenancy
- secret handling
- dependency and supply-chain risk
- input validation and output exposure
- abuse cases and operational failure modes

## Routing

- `$vet` remains the only security gate
- playbooks deepen `$vet`; they do not create a second security umbrella

## Product rule

Meta-Architect can absorb security arsenal patterns aggressively while still presenting them only as native guidance and packaged references.

## Adversarial hardening

- For higher-risk changes, run a bounded adversarial hardening pass before final approval.
- Keep the hardening work inside the private scratchpad/runtime layer.
- Return structured findings, not direct gate mutations.
