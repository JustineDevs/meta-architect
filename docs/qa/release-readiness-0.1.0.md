# Release Readiness 0.1.0

## Production bar

`v0.1.0` is treated as production only when:
- the package installs cleanly from the canonical public install command
- the Codex-hosted runtime path works end to end
- the helper flow remains valid for scripted verification
- release docs, package metadata, and workflows all agree on `0.1.0`

Target release state:
- npm package: `@jstn-sdk/ma@0.1.0`
- npm registry state: `npm publish` returned success on `2026-05-02`
- publishability note: verify `npm view @jstn-sdk/ma version dist-tags time --json` again after registry propagation completes
- git tag: `v0.1.0`
- GitHub release: published at `2026-05-02T10:59:33Z`

## Production checklist

- skills-first product identity: PASS
- package/plugin identity aligned to `@jstn-sdk/ma`: PASS
- version/tag alignment `0.1.0` / `v0.1.0`: PASS
- install/uninstall docs aligned: PASS
- onboarding is concise and sequential: PASS
- helper command documented as secondary: PASS
- skills/prompts/manifests aligned: PASS
- packaging includes required assets: PASS
- tests pass: PASS
- package dry-run passes: PASS
- installed-package behavior passes: PASS
- workflow/release/provenance docs aligned: PASS
- no stale package names remain in tracked repo surfaces: PASS
- no conflicting CLI-first product story remains in tracked product docs: PASS

## Automated checks run

```bash
npm run release:check
```

That must cover:
- skills manifest generation
- skill validation
- skill bundle packaging
- repo checks
- automated tests
- npm package dry-run inspection

## Manual/behavioral checks run

Canonical launch:

```bash
ma --madmax --high
```

Helper-path validation:

```bash
ma setup
ma idea "Build a demo app"
ma run '$arch'
ma run '$sage'
ma run '$flow'
ma run '$vet'
ma run '$vibe'
ma status
ma run '$build'
```

Expected evidence:
- `.ma/release.json` remains the source of truth
- `.ma/decisions.json` records the helper-path activity
- `$build` stays blocked until upstream gates are green, then becomes ready

## Known limitations

- interactive Codex conversation quality depends on the installed Codex host
- release publication still depends on npm ownership/authorization for the target package name
