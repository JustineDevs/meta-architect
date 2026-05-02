## Summary

Describe what changed and why.

## Base branch

- [ ] This PR targets `development`.
- [ ] This PR targets `main` only as a curated promotion or maintainer exception.

If targeting `main`, explain why:

## Scope

- [ ] Skills
- [ ] Prompts
- [ ] MCP mappings
- [ ] Plugin surface
- [ ] Docs
- [ ] CI / workflows
- [ ] Release packaging
- [ ] Other

## What changed

- 
- 
- 

## Why this change exists

Explain the problem, goal, or release hardening reason behind the change.

## Testing

List the checks you ran.

```bash
npm run skills:manifest
npm run skills:validate
npm run skills:pack
npm run skills:install -- --path ./dist/installed-skills
npm run check
npm test
```

Add any additional commands or manual verification notes below.

## Release sensitivity

- [ ] This PR changes release-sensitive files.
- [ ] This PR changes package metadata.
- [ ] This PR changes workflows.
- [ ] This PR changes skill contracts.
- [ ] This PR does not affect release behavior.

If release-sensitive, explain the impact:

## Documentation

- [ ] I updated relevant docs.
- [ ] No docs update was needed.

Docs touched:

- 
- 

## Runtime state hygiene

- [ ] I did not commit runtime `.ma` files such as logs, state, tmp, or cache.
- [ ] I verified no accidental release artifacts or temp files are included.

## Checklist

- [ ] I performed a self-review.
- [ ] The change is focused and intentional.
- [ ] The behavior matches the documented contract.
- [ ] I did not weaken gate enforcement or hide failures.
- [ ] I included enough context for reviewers.
