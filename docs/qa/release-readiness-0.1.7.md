# Release Readiness 0.1.7

## Production bar

`v0.1.7` is treated as production only when:
- the package installs cleanly from the canonical public install command
- the Codex-hosted runtime path works end to end
- the helper flow remains valid for scripted verification
- release docs, package metadata, and workflows all agree on `0.1.7`

Target release state:
- npm package: `@jstn-sdk/ma@0.1.7`
- npm registry state: pending publish
- publishability note: `0.1.6` is already published, so `0.1.7` is the next publishable package line
- git tag: `v0.1.7`
- GitHub release: pending publish for `v0.1.7`

## Production checklist

- skills-first product identity: PASS
- package/plugin identity aligned to `@jstn-sdk/ma`: PASS
- version/tag alignment `0.1.7` / `v0.1.7`: PASS
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
