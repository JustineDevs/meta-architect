# Mission: Fintech App

## Scenario

A team needs a fintech application where architectural decisions, evidence quality, and security posture matter more than convenience.

## Goal

Use Meta-Architect to take a fintech concept through architecture, evidence, logic, security, experience, and build readiness without weakening any gate.

## Constraints

- security review is mandatory
- evidence quality must be stronger than generic OSS guessing
- release cannot proceed with unresolved risk

## Evidence expectations

- `$sage` should bind major choices to approved sources
- security-sensitive choices should be traceable in evidence

## Expected gate movement

- `idea_status: DRAFT -> CLEAR`
- `architecture_status: DRAFT -> APPROVED`
- `evidence_status: MISSING -> VERIFIED | PARTIAL`
- `logic_status: PENDING -> GREEN`
- `security_status: PENDING -> GREEN | RED`
- `experience_status: PENDING -> GREEN | WAIVED`
- `build_status: LOCKED -> READY`

## Expected generated artifacts

- `.meta-architect/decisions.json`
- `.meta-architect/release.json`
- `.meta-architect/evidence/sources.json`
- `.meta-architect/evidence/audits.json`
- `.meta-architect/evidence/cves.json`

## Pass criteria

- architecture is explicit
- evidence is traceable
- security review is recorded
- build stays locked until gates pass

## Fail criteria

- security review is skipped
- evidence is missing or fabricated
- build unlocks before required gates are green
