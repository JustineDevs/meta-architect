# Release Readiness 0.1.0

## Production bar

`v0.1.0` is treated as production only when:
- the package installs cleanly from the canonical public install command
- the Codex-hosted runtime path works end to end
- the helper flow remains valid for scripted verification
- release docs, package metadata, and workflows all agree on `0.1.0`

Target release state:
- npm package: `@jstn-sdk/meta-architect@0.1.0`
- npm registry state: unpublished on `2026-05-02T10:55:40.950Z`
- publishability note: npm will not allow `0.1.0` to be reused after unpublish
- git tag: `v0.1.0`
- GitHub release: published at `2026-05-02T10:59:33Z`

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
