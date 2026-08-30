# Release Readiness 0.14.2

## Production bar

`v0.14.2` is treated as production only when:
- the package installs cleanly from the canonical public install command
- the Codex-hosted runtime path works end to end
- the helper flow remains valid for scripted verification
- the singular `$maestro` umbrella and helper-skill contract stay coherent
- release docs, package metadata, and workflows all agree on `0.14.2`

Target release state:
- npm package: `@jstn-sdk/ma@0.14.2`
- npm registry state: pending publish
- publishability note: `0.14.1` is already published, so `0.14.2` is the next publishable package line
- git tag: `v0.14.2`
- GitHub release: pending publish for `v0.14.2`

## Production checklist

- skills-first product identity: PASS
- package/plugin identity aligned to `@jstn-sdk/ma`: PASS
- version/tag alignment `0.14.2` / `v0.14.2`: PASS
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
- issue proof gates for `v0.14.2`: PASS; `release-issue-gates-0.14.2.json` marks issues `#13-#29` passed with implementation, verification, and production evidence, so release verification can enforce the gate artifact instead of blocking on pending issue states

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

## Issue proof gates

Issue gate artifact:

```text
docs/qa/release-issue-gates-0.14.2.json
```

Every open issue assigned to `v0.14.2` must remain in this file until it is production-passed. A passed issue requires:
- implementation evidence
- verification evidence
- production evidence

If any issue is `pending`, `in_progress`, `blocked`, or `failed`, `npm run release:verify` must fail and the issue must continue through its recorded loop action.

## Manual/behavioral checks run

Canonical launch:

```bash
ma --madmax --high
```

Helper-path validation:

```bash
ma setup
ma idea "Harden Meta-Architect v0.14.2 semantic core with Obsidian vault context, Ralph execution proof, context economy, and package-gated release evidence"
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
