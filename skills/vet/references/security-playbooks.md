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

## Product boundary

This pack deepens `$vet`; it does not create a new security skill family. Security patterns are packaged as Meta-Architect guidance, not as mirrored external catalogs or branded upstream surfaces.
