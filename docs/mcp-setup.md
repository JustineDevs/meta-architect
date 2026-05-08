# MCP / GitMCP Setup

1. Use approved discovery accelerators when you need to find OSS candidates faster than browsing GitHub directly.
2. Add repo-specific GitMCP endpoints in `mcp/servers.json` for any project you want to treat as approved evidence.
3. Confirm categories in `mcp/collections.json`.
4. Use `https://gitmcp.io/docs` only when no approved exact endpoint exists.

## Discovery vs verification

Canonical `$sage` order:

1. If the upstream repository or official docs are already known, start there first.
2. If not, use approved discovery accelerators to build a candidate set quickly.
3. Convert promising candidates into exact upstream repository mappings in `mcp/servers.json`.
4. Verify the choice against the upstream repo and official docs.
5. Treat the result as `VERIFIED`, `PARTIAL`, or `UNVERIFIED` based on what was actually proven.

The following external discovery surfaces are part of the Meta-Architect discovery standard:

- `https://ossium.live/home`
  - use for trending OSS, curated repositories, YC-backed repos, GSoC orgs, and contribution leads
- `https://trendshift.io/`
  - use for rising GitHub repository engagement, topic-driven exploration, and trend signals
- `https://devhunt.org/`
  - use for newly launched developer tools and discovery of current dev-tool products
- `https://libraries.io/`
  - use for package, ecosystem, license, and dependency metadata
  - caution: Libraries.io says its public data is scraped and "not validated, corrected, or curated for accuracy"
- `https://openhub.net/`
  - use for project activity, contributor, popularity, and comparative OSS project signals
- `https://www.opensourceprojects.dev/`
  - use for curated open-source project discovery, detailed project writeups, and higher-signal project scouting

Use it for:
- discovering candidate repositories
- spotting trending or actively curated OSS
- finding contribution-friendly projects and issue flows
- finding YC-linked or GSoC-linked OSS leads faster
- checking package-ecosystem metadata, maintenance signals, and dependency context
- checking project activity and contributor/comparison signals
- checking curated project writeups and hand-picked OSS recommendations

Do not treat any of these discovery surfaces alone as VERIFIED build-unlocking evidence.

To move from discovery to VERIFIED evidence:
- identify the upstream GitHub repository or official package/docs source from the discovery surface
- map that repo to an exact `https://gitmcp.io/{owner}/{repo}` endpoint in `mcp/servers.json`
- validate the choice against the upstream repo and official docs through `$sage`
