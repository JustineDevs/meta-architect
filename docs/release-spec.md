# v0.1.0 Requirements & Rules

## Production definition

Meta-Architect `v0.1.0` is production only when:
1. the package/install surface works
2. the runtime workflow from `$arch` through `$build` works
3. the release evidence matches the actual package and git tag

## What `v0.1.0` must have

### 1. Canonical package/runtime path

- install: `npm i -g @openai/codex@latest @jstn-sdk/meta-architect@latest`
- launch: `ma --madmax --high`
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

### 4. Required release evidence

- `package.json` version `0.1.0`
- git tag `v0.1.0`
- `RELEASE.md`
- `CHANGELOG.md`
- `docs/qa/release-readiness-0.1.0.md`
- green `npm run release:check`
