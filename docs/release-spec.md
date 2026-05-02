# v0.1.3 Requirements & Rules

## Production definition

Meta-Architect `v0.1.3` is production only when:
1. the package/install surface works
2. the in-session skill workflow from `$arch` through `$build` works
3. the release evidence matches the actual package and git tag

## What `v0.1.3` must have

### 1. Canonical package/runtime path

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

- `package.json` version `0.1.3`
- git tag `v0.1.3`
- `RELEASE.md`
- `CHANGELOG.md`
- `docs/qa/release-readiness-0.1.3.md`
- green `npm run release:check`

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
7. Create and push tag `v<version>`
8. Preferred publish path: publish from `.github/workflows/npm-publish.yml` on a supported cloud runner so provenance can be generated
9. Local shell fallback when not publishing from GitHub Actions or GitLab CI/CD:
   - Stable publish: `npm publish --access public`
   - Prerelease publish: `npm publish --access public --tag <lane>`
10. Verify dist-tags with `npm view @jstn-sdk/ma version dist-tags time --json`

### 7. Provenance rule

- `npm publish --provenance` is valid only from a supported cloud CI/CD provider
- local shell publishes are expected to fail with `Automatic provenance generation not supported for provider: null`
- use the repository publish workflow when provenance is part of the release bar
