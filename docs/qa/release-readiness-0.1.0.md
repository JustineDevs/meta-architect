# Release Readiness 0.1.0

## Production bar

`v0.1.0` is treated as production only when:
- the core workflows are reliable end-to-end,
- the public interface and release contract are stable,
- and the release has documented verification evidence.

## Automated checks run

```bash
npm run check
npm test
npm run skills:validate
```

## Manual checks run

Typical release-critical flow:

```bash
ma init
ma idea "Build a demo app"
ma run '$arch'
ma run '$sage'
ma run '$flow'
ma run '$vet'
ma run '$vibe'
ma status
ma run '$build'
```

## Required evidence

- gate contract matches runtime behavior
- publishable skills validate and pack
- build and release policies remain explicit

## Known limitations

- worktree lifecycle is still operator-driven
- release publication still depends on explicit channel success
