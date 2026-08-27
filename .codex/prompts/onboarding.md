# Onboarding

Meta-Architect is a skills-first system for Codex with a strict kernel.

## What is implemented

The primary product surface is the in-session skill flow:
- `$maestro` (the umbrella manager and recommended first step)
- `$arch`
- `$sage`
- `$flow`
- `$vet`
- `$vibe`
- `$build`

Secondary helper commands remain available through:
- `ma setup`
- `ma doctor`
- `ma welcome`
- `ma context refresh`
- `ma init`
- `ma idea`
- `ma skills`
- `ma status`
- `ma run '$arch'`
- `ma run '$sage'`
- `ma run '$flow'`
- `ma run '$vet'`
- `ma run '$vibe'`
- `ma run '$build'`
- `ma merge`
- `ma release`

## What to learn first

1. Read `README.md`
2. Read `docs/getting-started.md`
3. Read `docs/release-spec.md`
4. Read `docs/skills.md`
5. Start Codex context if needed, then use `$maestro` to select the next safe lane

## What not to do

- Do not edit `.ma/release.json` or `.ma/decisions.json` manually to bypass the gate model.
- Do not treat `.ma` support files as public source.
- Do not claim release channels succeeded without proof.
