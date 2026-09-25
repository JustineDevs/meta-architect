# v0.15.1 Requirements & Rules

## Production definition

Meta-Architect `v0.15.1` is production only when:
1. the package/install surface works
2. the in-session skill workflow from `$arch` through `$build` works
3. the release evidence matches the actual package and git tag

## What `v0.15.1` must have

### 1. Canonical package/runtime path

- recommended POSIX install: download the latest installer and checksum through jsDelivr, verify the downloaded installer with `sha256sum -c`, then run `sh install.sh`
- install: `npm i -g @openai/codex@latest @jstn-sdk/ma@latest`
- optional helper launch: `ma --madmax --high`
- uninstall Meta-Architect only: `npm uninstall -g @jstn-sdk/ma`
- uninstall Meta-Architect and Codex: `npm uninstall -g @jstn-sdk/ma @openai/codex`
- runtime trigger surface:
  - `$arch`
  - `$sage`
  - `$flow`
  - `$vet`
  - `$vibe`
  - `$build`

### 2. Secondary helper path

Helper commands remain available for setup and scripted validation:
- `ma setup`
- `ma idea`
- `ma run ...`
- `ma status`
- `ma merge`
- `ma release`

`ma merge` and `ma release` are approval-only by default. `--dry-run` performs
preflight without changing release state; `--execute` is the only mode that
runs the displayed `git merge --no-ff --no-edit -- <source>` command.

### 3. State and gate contract

Canonical runtime namespace:
- `.ma/`

Canonical state files:
- `.ma/decisions.json`
- `.ma/release.json`
- `.ma/evidence/*`
- `.ma/context/*`
- `.ma/specs/*`
- `.ma/plans/*`
- `.ma/runbook.md`

### 4. Required release evidence

- `package.json` version `0.15.1`
- git tag `v0.15.1`
- `RELEASE.md`
- `CHANGELOG.md`
- `docs/qa/release-readiness-0.15.1.md`
- `docs/qa/release-issue-gates-0.15.1.json`
- green `npm run release:check`
- GitHub release asset `meta-architect_0.15.1_all.deb`
- GitHub release asset `meta-architect-0.15.1-1-any.pkg.tar.xz`
- GitHub release asset `meta-architect-0.15.1-1.noarch.rpm`
- green `npm run linux:packages:build`
- green `npm run linux:packages:smoke`
- green `npm run release:assets`

### 5. Dist-tag discipline

- stable versions such as `0.1.2` publish to npm `latest`
- prerelease versions such as `0.2.0-beta.1` must publish with explicit tags such as `beta`
- recommended alternate lanes are `next`, `beta`, and `canary`
- prerelease publication must use `npm publish --tag <lane>`
- stable publication keeps scoped public access and provenance enabled

### 6. Canonical bump and publish flow

1. Run `npm version <version> --no-git-tag-version`
2. Update `CHANGELOG.md`
3. Update `RELEASE.md`
4. Update `docs/qa/release-readiness-<version>.md`
5. Run `npm run release:verify`
6. Run `npm run release:check`
7. Build and smoke-check the Linux native packages on Linux:
   - `npm run linux:packages:build`
   - `npm run linux:packages:smoke`
- `npm run release:assets`
- `npm run release:assets:generate` creates `dist/SHA256SUMS`, `dist/sbom.spdx.json`, and `dist/release-summary.json`; `release:assets` verifies them.
- `dist/` is CI-generated and ignored by Git. GitHub Releases are the source of truth for downloadable packages; historical binaries are not retained in the repository.
8. Merge the promotion PR. `.github/workflows/auto-release-tag.yml` creates and pushes `v<version>` from the resulting `main` commit idempotently.
9. Preferred publish path: publish from `.github/workflows/npm-publish.yml` on a supported cloud runner so provenance can be generated
10. Local shell fallback when not publishing from GitHub Actions or GitLab CI/CD:
   - Stable publish: `npm publish --access public`
   - Prerelease publish: `npm publish --access public --tag <lane>`
11. Verify dist-tags with `npm view @jstn-sdk/ma version dist-tags time --json`
12. Verify the GitHub release contains `dist/meta-architect-skills.tgz`, `meta-architect_<version>_all.deb`, `meta-architect-<version>-1-any.pkg.tar.xz`, and `meta-architect-<version>-1.noarch.rpm`

### 6.1 Release automation

- `npm run release:sync` updates the active release line when watched release-relevant files changed
- `npm run release:advance` force-bumps the next patch line after a completed release
- `.github/workflows/release-sync.yml` automates the sync path on `main`
- `.github/workflows/release-advance.yml` advances the repo to the next patch line after a published release
- `.github/workflows/promote-dev.yml` creates or reuses the single `dev` to `main` promotion PR and queues auto-merge when policy allows it
- `.github/workflows/auto-release-tag.yml` tags the exact merged `main` commit, which starts the GitHub Release and npm publication workflows
- If the repository disallows the default Actions token from creating pull requests, configure the one-time `RELEASE_BOT_TOKEN` repository secret. The token must be limited to pull-request and contents write access. Required reviews, signatures, and code scanning remain enforced.

### 6.2 Issue proof gates

Every open issue assigned to this release must be represented in the versioned release gate file. The file is a release-scoped proof manifest, not a mirror of every currently open repository issue; repository-wide issue closure requires separate GitHub issue evidence.

Production pass rule:
- issue status must be `passed`
- issue milestone must match `v0.15.1`
- implementation evidence must be present
- verification evidence must be present
- production evidence must be present
- pending, blocked, failed, or in-progress issues must continue through their loop action instead of being treated as release-ready

`npm run release:verify` enforces this file. If any issue is not production-passed, the release remains blocked.

### 7. Provenance rule

- `npm publish --provenance` is valid only from a supported cloud CI/CD provider
- local shell publishes are expected to fail with `Automatic provenance generation not supported for provider: null`
- use the repository publish workflow when provenance is part of the release bar
## Package diagnostics

`npm run package:doctor` (or `npm run release:doctor`) checks maintainer-facing
release and package artifacts. It is distinct from `ma doctor`, which checks
installed/user environment health.
It is intentionally separate from `ma doctor`, which checks the installed
environment, runtime state, MCP readiness, and support bundle health.
