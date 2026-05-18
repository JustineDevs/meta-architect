# Release Readiness 0.1.13

## Production bar

`v0.1.13` is treated as production only when:
- the package installs cleanly from the canonical public install command
- the Codex-hosted runtime path works end to end
- the helper flow remains valid for scripted verification
- the singular `$maestro` umbrella and helper-skill contract stay coherent
- release docs, package metadata, and workflows all agree on `0.1.13`

Target release state:
- npm package: `@jstn-sdk/ma@0.1.13`
- npm registry state: pending publish
- publishability note: `0.1.12` is already published, so `0.1.13` is the next publishable package line
- git tag: `v0.1.13`
- GitHub release: pending publish for `v0.1.13`

## Production checklist

- skills-first product identity: PASS
- package/plugin identity aligned to `@jstn-sdk/ma`: PASS
- version/tag alignment `0.1.13` / `v0.1.13`: PASS
- install/uninstall docs aligned: PASS
- onboarding is concise and sequential: PASS
- helper command documented as secondary: PASS
- skills/prompts/manifests aligned: PASS
- packaging includes required assets: PASS
- Linux native package release lane wired: PASS
- singular `$maestro` umbrella surface: PASS
- helper skill family shipped but non-gating: PASS
- native playbooks and support-bundle reference assets aligned: PASS
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

Linux-native release lane:

```bash
npm run linux:packages:build
npm run linux:packages:smoke
npm run release:assets
```

That should prove:
- the Debian-family, Arch-family, and Fedora/openSUSE-style package artifacts are produced
- the extracted package payload exposes a working `ma` command
- the GitHub release asset set is complete
- the packaged support bundle contains the playbooks and reference assets expected by the runtime

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
- `$maestro` remains the only umbrella surface
- helper skills remain non-gating
- `$build` stays blocked until upstream gates are green, then becomes ready

## Known limitations

- interactive Codex conversation quality depends on the installed Codex host
- release publication still depends on npm ownership/authorization for the target package name
