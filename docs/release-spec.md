# V0.1.0 Requirements & Rules

## Production definition

Meta-Architect `v0.1.0` is production only when all three are true at the same time:

1. Core workflows are reliable end-to-end.
2. The public interface and contract are stable.
3. There is documented evidence that the release works.

Production here means safe to recommend for real projects and expensive to break without a major version change.

## What v0.1.0 MUST have

### 1. Core workflow working end-to-end

1. `ma setup`
   - Creates `.codex/`, `.ma/`, `mcp/`, and baseline `docs/` without breaking existing files.
   - Leaves the repo in a valid Git + MCP state.

2. MCP / GitMCP wiring
   - At least one real GitMCP endpoint configured.
   - `$sage` and `$arch` can successfully query via MCP without schema/protocol errors.

3. Skill pipeline
   - `ma idea "..."`
   - `ma run $arch`
   - `ma run $sage`
   - `ma run $flow`
   - `ma run $vet`
   - `ma run $vibe`
   - `ma status`
   - `ma run $build`

4. One hello-world feature cycle
   - `$build` proposes at least one `feature/*` branch.
   - Operator can implement a small change, merge to `development`, and mark the build as done without touching internal files manually.

5. Two-environment confidence
   - The documented initialization and skill flow must be reproducible on at least two machines or environments before release sign-off.

### 2. Gate and status rules

Status fields in `.ma/decisions.json`:
- `idea_status`
- `architecture_status`
- `evidence_status`
- `logic_status`
- `security_status`
- `experience_status`
- `build_status`
- `merge_status`
- `release_status`

Allowed values:
- `idea_status`: `DRAFT`, `CLEAR`, `BLOCKED`
- `architecture_status`: `DRAFT`, `REVIEWED`, `APPROVED`
- `evidence_status`: `MISSING`, `PARTIAL`, `VERIFIED`
- `logic_status`: `PENDING`, `GREEN`, `RED`
- `security_status`: `PENDING`, `GREEN`, `RED`
- `experience_status`: `PENDING`, `GREEN`, `RED`, `WAIVED`
- `build_status`: `LOCKED`, `READY`, `RUNNING`, `DONE`
- `merge_status`: `LOCKED`, `READY`, `MERGED_TO_DEVELOPMENT`
- `release_status`: `LOCKED`, `READY`, `SHIPPED_TO_PROD`

Build lock rule:
- `$build` must not run unless:
  - `idea_status = CLEAR`
  - `architecture_status = APPROVED`
  - `evidence_status = VERIFIED`
  - `logic_status = GREEN`
  - `security_status = GREEN`
  - `experience_status` is `GREEN` or `WAIVED`
  - `build_status` is `LOCKED` or `READY`

Public contract freeze for `v0.1.0`:
- Core triggers remain stable:
  - `ma setup`
  - `ma idea`
  - `ma skills`
  - `ma status`
  - `ma run $arch`
  - `ma run $sage`
  - `ma run $flow`
  - `ma run $vet`
  - `ma run $vibe`
  - `ma run $build`
  - `ma merge`
  - `ma release`
- Required status fields and allowed values are frozen for the `1.x` line unless changed by a major version.
- Basic branch policy remains:
  - `feature/* -> development -> prod`
  - optional approved `release/*` before `prod`

### 3. Branch and merge policy

- `prod`: production branch
- `development`: integration branch
- `feature/*`: short-lived task branches

Rules:
- Feature work merges into `development`, never directly into `prod`.
- Release happens from `development` or approved `release/*` into `prod`.
- `$build` creates or recommends `feature/*` branches; it does not modify `development` or `prod` directly.

## Repository workflow strategy

This document also distinguishes the Meta-Architect product branch model from the Meta-Architect repository workflow.

Repository workflow:

- `main` = release-facing protected branch for this repository
- `development` = normal integration branch for this repository
- `feature/*` = normal contribution branches for this repository

Repository rules:

- contributors branch from `development`
- normal PRs target `development`
- only curated promotions move `development` into `main`
- direct pushes to `main` should be avoided except for genuine emergency or admin recovery cases

Required repository checks on both `development` and `main`:

- `validate`
- `pr-check`
- `codex-review`

### 4. Evidence and MCP rules

- `$sage` and `$arch` must provide at least one OSS source for each major library/framework recommendation.
- All such sources must be logged into `.ma/evidence/sources.json` with `repo`, `endpoint`, and `category`.
- If no suitable source is found, the recommendation must be marked `UNVERIFIED` and must not flip `evidence_status` to `VERIFIED`.
- Meta-Architect must never invent fake repos or endpoints.

### 5. Tests and QA

Minimum required tests:
- Contract tests per skill
- Gate logic tests
- MCP smoke test
- CLI smoke test
- Skill packaging validation tests

Required QA artifact:
- `docs/qa/release-readiness-0.1.0.md`

Required release evidence:
- release tag
- release body
- QA/readiness record
- known limitations and operational constraints

### 6. Required docs

- `README.md`
- `docs/getting-started.md`
- `docs/skills.md`
- `docs/release-spec.md`
- `docs/mcp-setup.md`
- `docs/qa/release-readiness-0.1.0.md`

## Production rule

Meta-Architect `v0.1.0` is considered production-ready only if:
- a new project can be initialized,
- at least one real GitMCP endpoint is wired and successfully queried,
- the full `$arch -> $sage -> $flow -> $vet -> $vibe -> $build` workflow runs with exact gate enforcement,
- at least one feature cycle completes cleanly,
- the skill publishing surface validates and packages from a clean checkout,
- the public contract is stable enough to avoid breaking changes in `1.x`,
- and all required tests, docs, release artifacts, and readiness evidence are present and passing.
