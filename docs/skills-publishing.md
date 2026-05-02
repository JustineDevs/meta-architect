# Skills Publishing

Meta-Architect ships skills through a deliberate source-to-package pipeline. This repository treats publishable skills as product artifacts, not as raw markdown files.

## Two skill surfaces

### 1. Internal runtime surface

Location:
- `.ma/skills/`

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

Do not confuse these two layers. The repo publishes `skills/`, not `.ma/`.

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

### Sync plugin mirror

```bash
npm run plugin:sync
npm run plugin:verify
```

Expected effect:
- `plugins/meta-architect/skills/` mirrors the canonical `skills/` surface
- the local marketplace and plugin bundle remain aligned with the package skill contract
- plugin drift fails verification instead of surviving into release artifacts

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
  - `arch`
  - `sage`
  - `flow`
  - `vet`
  - `vibe`
  - `build`

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
- package name: `@jstn-sdk/meta-architect`
- public publish config
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
- runtime `.ma` state
- local logs
- temp install targets
- generated local caches

The `skills:pack` tarball is narrower than the npm package:
- `skills:pack` => `skills/` distribution bundle
- `npm pack` => public npm package with the explicit `files` list

## Release and dist-tag discipline

Meta-Architect release behavior is lane-aware:
- stable versions publish to npm `latest`
- prerelease versions publish to explicit lanes such as `next`, `beta`, or `canary`
- prereleases must use `npm publish --tag <lane>`
- stable releases keep the default `latest` behavior and public scoped access

Before publish:
1. bump version with `npm version <version> --no-git-tag-version`
2. update changelog and release docs
3. run `npm run release:verify`
4. run `npm run release:check`
5. create and push tag `v<version>`
6. publish the package with the correct lane behavior
   - preferred: run `.github/workflows/npm-publish.yml` on a supported cloud runner so provenance can be generated
   - local fallback: omit `--provenance` and publish with `npm publish --access public` or `npm publish --access public --tag <lane>`
7. verify the resulting dist-tags with `npm view @jstn-sdk/meta-architect version dist-tags time --json`

## Plugin relation

The plugin bundle in:
- `plugins/meta-architect/`

is related but not identical to the npm/package skill bundle.

Relationship:
- `skills/` is the canonical publishable skill source
- `plugins/meta-architect/` is the plugin-installable consumer-facing bundle
- both should remain aligned in behavior and version intent
- `.agents/plugins/marketplace.json` advertises the local plugin source for discovery
- `plugins/meta-architect/.codex-plugin/plugin.json` is the plugin contract entrypoint

If a skill contract changes:
1. update `skills/`
2. regenerate manifest
3. sync the plugin mirror
4. validate skills
5. ensure plugin-facing bundle still reflects the same product contract

## Real commands for a release-minded flow

```bash
npm run skills:manifest
npm run plugin:sync
npm run skills:validate
npm run plugin:verify
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
- [plugins/meta-architect/.codex-plugin/plugin.json](../plugins/meta-architect/.codex-plugin/plugin.json)
- [../.agents/plugins/marketplace.json](../.agents/plugins/marketplace.json)
- [package.json](../package.json)
- [scripts/skills-manifest.js](../scripts/skills-manifest.js)
- [scripts/plugin-sync.js](../scripts/plugin-sync.js)
- [scripts/skills-validate.js](../scripts/skills-validate.js)
- [scripts/skills-pack.js](../scripts/skills-pack.js)
- [scripts/skills-install.js](../scripts/skills-install.js)
