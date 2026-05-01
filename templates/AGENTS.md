# Meta-Architect Operating Contract

This repository uses Meta-Architect as a structured orchestration layer for programmatic architecture and verified engineering. The purpose of this contract is to make repository behavior explicit, reviewable, and stable enough to be reused across generated or installed surfaces.

## Core triggers

The primary trigger surfaces are:

- `$arch` — architecture and stack blueprinting
- `$sage` — evidence-backed OSS discovery through MCP/GitMCP collections
- `$flow` — business logic and state-transition review
- `$vet` — security and risk review
- `$vibe` — DX/UX review
- `$build` — bounded implementation planning and build execution handoff

## Core rule

No implementation should proceed as if it were approved unless the required architecture, evidence, logic, and security gates are satisfied.

## Kernel vs extension model

Meta-Architect should be treated as a core system plus extension surfaces:

- **Core system**
  - state and decision files
  - gate enforcement
  - MCP endpoint policy
  - CLI orchestration commands
- **Extension surfaces**
  - publishable skill folders
  - plugin bundle
  - missions and demos
  - prompts and templates

The core must stay stable and inspectable. Extensions may vary, but they must not weaken the kernel contract.

## Gate rules

The repository recognizes the following status fields:

- `idea_status`
- `architecture_status`
- `evidence_status`
- `logic_status`
- `security_status`
- `experience_status`
- `build_status`
- `merge_status`
- `release_status`

### Build lock rule

`$build` must remain locked unless all of the following are true:

- `idea_status = CLEAR`
- `architecture_status = APPROVED`
- `evidence_status = VERIFIED`
- `logic_status = GREEN`
- `security_status = GREEN`
- `experience_status = GREEN` or `WAIVED`

If any required field is missing, red, or unverified, the workflow should stop and report blockers clearly.

### Merge and release rule

- `feature/*` work merges into `development`
- release promotion is allowed only from `development` or approved `release/*`
- no direct `feature/* -> prod`

## Evidence rule

Major technology recommendations must be supported by evidence from configured MCP/GitMCP sources. Do not invent fake repositories, fake endpoints, or unsupported claims.

### Exact endpoint rule

- Prefer repo-specific `https://gitmcp.io/{owner}/{repo}` endpoints
- Treat `https://gitmcp.io/docs` as fallback policy only, not a normal approved evidence source for build-unlocking decisions

## Logging rule

Architecture decisions, evidence, audits, and release-relevant outcomes should be written to repository-visible local files where applicable, especially:

- `.omx/decisions.json`
- `.omx/release.json`
- `.omx/evidence/sources.json`
- `.omx/evidence/audits.json`
- `.omx/evidence/cves.json`

## Skill routing

Use the role that best matches the task:

- Use `$arch` for system shape, stack options, component boundaries, trade-offs, and blueprinting.
- Use `$sage` for evidence-backed package, framework, and library selection.
- Use `$flow` for workflow correctness, state transitions, data flow, and edge-case review.
- Use `$vet` for security checks, dependency risk review, and release-sensitive blocking findings.
- Use `$vibe` for developer experience and user experience review.
- Use `$build` only after required gates are satisfied and only for bounded implementation planning or execution.

## Prompt behavior

When working in this repository:

- prefer explicit reasoning and explicit file changes
- do not skip validation steps silently
- do not weaken hooks or gates for convenience
- do not commit runtime `.omx` state
- do not treat release-sensitive changes as trivial edits

## Contributor expectation

Changes to skills, prompts, package metadata, workflows, release docs, or plugin surfaces are release-sensitive. These changes should be tested, documented, and described clearly in pull requests.

## Release expectation

Production release means:

- the core trigger flow works end-to-end
- release artifacts are validated
- skills packaging and installation succeed
- docs reflect actual behavior
- no hidden runtime residue is shipped as source

## Related surfaces

- `CONTRIBUTING.md`
- `docs/release-spec.md`
- `templates/catalog-manifest.json`
- `prompts/`
- `skills/`
