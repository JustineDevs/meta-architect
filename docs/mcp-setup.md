# MCP / GitMCP Setup

The MCP client advertises the installed Meta-Architect version read from the
package metadata. `ma doctor` reports the same value, while `0.0.0-dev` is used
only when development metadata is unavailable.

1. Use approved discovery accelerators when you need to find OSS candidates faster than browsing GitHub directly.
2. Add repo-specific GitMCP endpoints in `mcp/servers.json` for any project you want to treat as approved evidence.
3. Confirm categories in `mcp/collections.json`.
4. Do not add `https://gitmcp.io/docs` to `mcp/servers.json`; verified evidence requires exact repo-form GitMCP endpoints only.

## First-party local capabilities

`mcp/local-capabilities.json` is separate from `mcp/servers.json`. It is the allowlist for Meta-Architect's packaged local capabilities:

- `_state`
- `memory`
- `trace`
- `team_run`
- `code_intel`
- `playbooks`
- `context`

`playbooks` is a read-only packaged capability. It does not point at external MCP servers and it does not repurpose `mcp/collections.json`.

Its contract for this release is:

- manifest: `mcp/native-playbooks.json`
- module: `mcp/local/playbooks.js`
- transport: `inproc`
- behavior: packaged resource reads only, no mutating local tools

If bootstrap or doctor reports a `playbooks` readiness warning, repair the packaged support bundle inputs rather than adding more GitMCP sources.

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

## Remote MCP transport

`$sage` opens configured GitMCP endpoints as live MCP servers. Some remote MCP hosts reject direct SSE probes with HTTP 405 and require a host-supported remote MCP bridge. Meta-Architect treats that as a transport blocker, not as verified evidence.

To enable bridge-backed live verification, configure a trusted local bridge command:

```bash
export MA_MCP_REMOTE_BRIDGE_CMD="mcp-remote {url}"
export MA_MCP_REMOTE_BRIDGE_ALLOWLIST="mcp-remote"
```

The `{url}` placeholder is replaced with the exact repo endpoint from `mcp/servers.json`. The command must be explicitly allowlisted by basename or exact path in `MA_MCP_REMOTE_BRIDGE_ALLOWLIST`, or by a project-local `mcp/bridge.json` file such as `{ "allowedCommands": ["mcp-remote"] }`. Use a preinstalled, trusted bridge binary or wrapper; do not depend on automatic package downloads in production verification.

Bridge startup, exit, failure, and bounded stderr diagnostics are recorded as
redacted receipts under `.ma/evidence/mcp-bridge-receipts/`. The bridge receives
only a minimal environment allowlist, and request timeouts are bounded by
`MA_MCP_REQUEST_TIMEOUT_MS` (15 seconds by default). `ma doctor` should be used
to verify the command policy before live evidence collection.

When no bridge is configured:
- direct-SSE-compatible MCP servers can still verify normally
- GitMCP 405 responses are recorded as bridge-required blockers
- `evidence_status` remains `PARTIAL`, so `$flow` and `$build` stay locked

## Separation of concerns

- `mcp/servers.json` remains for repo-specific GitMCP evidence sources
- `mcp/collections.json` remains GitMCP-oriented evidence categorization for this release
- `mcp/local-capabilities.json` is the first-party in-process capability registry
- `mcp/native-playbooks.json` is internal native curation metadata, not an upstream mirror or user-edited evidence source list

## Current semantic source routing

`mcp/collections.json` maps configured repository evidence into MA lanes.
The current release intentionally includes both broad discovery lists and core-specific upstream sources.

| Collection | Why it exists | Typical lanes |
| --- | --- | --- |
| `meta-list` and language collections | broad OSS candidate discovery before exact upstream selection | `$arch`, `$sage` |
| `system-design` | architecture and flow reasoning references | `$arch`, `$sage`, `$flow`, `$build` |
| `security` | trust-boundary and security review evidence | `$vet` |
| `obsidian-api-docs` | Obsidian API evidence for vault, metadata, workspace, and plugin behavior | `$arch`, `$sage`, `$vibe` |
| `obsidian-plugin-scaffold` | compatibility reference for MA's in-app Obsidian plugin surface | `$arch`, `$sage` |
| `context-economy` | context-budget and terse-output source evidence | `$sage`, `$vet`, `$vibe`, `$build` |
| `prompt-techniques` | prompt strategy source evidence for MA-owned prompt policies | `$arch`, `$sage`, `$flow`, `$vet`, `$vibe`, `$build` |

Obsidian-derived notes remain `vault_context`.
They do not count as `build_evidence` unless `$sage`, `$vet`, or another owning lane promotes a specific claim with source-backed proof.
## Local context capability

The setup-owned local MCP registry exposes read-only context evidence through
the `context` capability. Its resources are:

- `context://project-index` — source-truth project fingerprint and file metadata.
- `context://freshness` — incremental refresh status and changed-file evidence.
- `context://learning` — validated learning-loop state.
- `context://obsidian` — validated vault index and operation receipts when configured.
- `context://hooks` — hook configuration and audit evidence.
- `context://commands` — source-derived command map.
- `context://agent-brief` — bounded first-read generated context.
- `context://architecture` — bounded generated architecture map.

Every response includes `record_type`, `authority`, `source`, and `available`
metadata. Missing optional artifacts return an unavailable result; writes are
not exposed by this capability.
