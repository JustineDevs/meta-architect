# Skills Publishing

Meta-Architect ships skills through a deliberate source-to-package pipeline. This repository treats publishable skills as product artifacts, not as raw markdown files.

## Two skill surfaces

### 1. Internal runtime surface

Location:
- `.meta-architect/skills/`

Purpose:
- local runtime behavior
- internal command contracts
- generated or seeded operator surfaces

### 2. Publishable skill surface

Location:
- `skills/`

Purpose:
- installable Codex skill folders
- UI metadata via `agents/openai.yaml`
- versionable public skill contract

Do not confuse these two layers. The repo publishes `skills/`, not `.meta-architect/`.

## Canonical packaging flow

### Generate manifest

```bash
npm run skills:manifest
```

Expected effect:
- writes `skills/index.json`
- manifest entries should match the actual skill directories

### Validate skills

```bash
npm run skills:validate
```

Expected effect:
- every skill folder passes the validator
- missing or invalid frontmatter should fail the command
- missing or structurally incomplete `agents/openai.yaml` should fail the command

### Create bundle

```bash
npm run skills:pack
```

Expected effect:
- creates `dist/meta-architect-skills.tgz`
- bundle should be non-empty

### Smoke-test install

```bash
npm run skills:install -- --path ./dist/installed-skills
```

Expected effect:
- all publishable skill folders are copied to the target install path
- install target should contain:
  - `meta-architect`
  - `meta-architect-arch`
  - `meta-architect-sage`
  - `meta-architect-flow`
  - `meta-architect-vet`
  - `meta-architect-vibe`
  - `meta-architect-build`

## Expected outputs

### `skills/index.json`

Should contain:
- schema version
- skill names
- repo-local path mapping
- descriptions

### `dist/meta-architect-skills.tgz`

Should contain:
- `skills/`
- each skill folder
- each `SKILL.md`
- each `agents/openai.yaml`
- any intended references/assets

It should **not** rely on hidden runtime state.

Important:
- `npm run skills:pack` creates the **skills bundle tarball only**
- it is not the same thing as the broader npm package tarball from `npm pack`
- the npm package surface is controlled separately by `package.json > files`

## Source vs package contents

The npm package and tarball should stay explicit.

Current package intent:
- package name: `@jstn-sdk/meta-architect-skills`
- public scoped publish config
- explicit `files` list in `package.json`

The publishable package should include:
- `bin/`
- `skills/`
- `docs/`
- `scripts/`
- `index.js`
- `README.md`
- `LICENSE`

It should not include:
- runtime `.meta-architect` state
- local logs
- temp install targets
- generated local caches

The `skills:pack` tarball is narrower than the npm package:
- `skills:pack` => `skills/` distribution bundle
- `npm pack` => public npm package with the explicit `files` list

## Plugin relation

The plugin bundle in:
- `plugins/meta-architect/`

is related but not identical to the npm/package skill bundle.

Relationship:
- `skills/` is the canonical publishable skill source
- `plugins/meta-architect/` is the plugin-installable consumer-facing bundle
- both should remain aligned in behavior and version intent

If a skill contract changes:
1. update `skills/`
2. validate skills
3. regenerate manifest
4. ensure plugin-facing bundle still reflects the same product contract

## Real commands for a release-minded flow

```bash
npm run skills:manifest
npm run skills:validate
npm run skills:pack
npm run skills:install -- --path ./dist/installed-skills
npm run pack:inspect
```

## Expected failure modes

- manifest drift:
  - `skills/index.json` does not match actual skill directories
- invalid skill:
  - malformed frontmatter
  - missing `SKILL.md`
  - invalid `agents/openai.yaml`
- package drift:
  - tarball includes files not intended for public distribution
- plugin drift:
  - plugin bundle no longer matches the published skill contract

## Release artifact expectations

Before a release is considered real:
- `skills/index.json` must be current
- `dist/meta-architect-skills.tgz` must exist
- install smoke test must pass
- package inspection must be sane
- docs must match the published behavior

## Related surfaces

- [README.md](../README.md)
- [docs/skills.md](./skills.md)
- [plugins/meta-architect/README.md](../plugins/meta-architect/README.md)
- [package.json](../package.json)
- [scripts/skills-manifest.js](../scripts/skills-manifest.js)
- [scripts/skills-validate.js](../scripts/skills-validate.js)
- [scripts/skills-pack.js](../scripts/skills-pack.js)
- [scripts/skills-install.js](../scripts/skills-install.js)
