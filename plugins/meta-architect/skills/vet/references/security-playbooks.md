# Security Playbooks

Use this reference pack inside `$vet` for repeatable trust-boundary reviews that stay native to Meta-Architect.

## Core review slices

- identity and session boundaries
- authorization and tenancy boundaries
- secret handling and key rotation assumptions
- dependency and supply-chain trust
- inbound data validation and outbound data exposure
- operational abuse cases and failure modes

## How to use the playbooks

- Start with the architecture and evidence already approved by `$arch` and `$sage`.
- Focus on the highest-risk boundary first.
- Distinguish blockers from accepted risk.
- Route remediation back to the owning lane rather than creating a parallel security workflow.

## Adversarial hardening

- For higher-risk changes, run a bounded adversarial hardening pass before final approval.
- Keep the hardening work inside the private scratchpad/runtime layer.
- Return structured findings, not direct gate mutations.
- If the hardening pass cannot resolve or clearly classify the risk, keep `$vet` in a non-terminal state instead of over-approving.

## Product boundary

This pack deepens `$vet`; it does not create a new security skill family. Security patterns are packaged as Meta-Architect guidance, not as mirrored external catalogs or branded upstream surfaces.
