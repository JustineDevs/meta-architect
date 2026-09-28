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

<table>
  <tr><th>Capability</th><th>Boundary</th></tr>
  <tr><td><code>_state</code>, <code>memory</code>, <code>trace</code></td><td>Read-only runtime state and evidence context.</td></tr>
  <tr><td><code>team_run</code>, <code>code_intel</code></td><td>Bounded local orchestration and code intelligence.</td></tr>
  <tr><td><code>playbooks</code>, <code>context</code></td><td>Packaged guidance and project context reads.</td></tr>
</table>

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

<table>
  <tr><th>Surface</th><th>Use</th></tr>
  <tr><td><a href="https://ossium.live/home">Ossium</a></td><td>Trending OSS, curated repositories, YC-backed repos, GSoC orgs, and contribution leads.</td></tr>
  <tr><td><a href="https://trendshift.io/">Trendshift</a></td><td>Rising GitHub engagement, topic exploration, and trend signals.</td></tr>
  <tr><td><a href="https://devhunt.org/">DevHunt</a></td><td>New developer tools and current product discovery.</td></tr>
  <tr><td><a href="https://libraries.io/">Libraries.io</a></td><td>Package, ecosystem, license, and dependency metadata. Its public data is not guaranteed to be validated or curated.</td></tr>
  <tr><td><a href="https://openhub.net/">OpenHub</a></td><td>Project activity, contributor, popularity, and comparison signals.</td></tr>
  <tr><td><a href="https://www.opensourceprojects.dev/">Open Source Projects</a></td><td>Curated project discovery and higher-signal project scouting.</td></tr>
</table>

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

<table>
  <tr><th>File</th><th>Responsibility</th></tr>
  <tr><td><code>mcp/servers.json</code></td><td>Repository-specific GitMCP evidence sources.</td></tr>
  <tr><td><code>mcp/collections.json</code></td><td>GitMCP-oriented evidence categorization.</td></tr>
  <tr><td><code>mcp/local-capabilities.json</code></td><td>First-party in-process capability registry.</td></tr>
  <tr><td><code>mcp/native-playbooks.json</code></td><td>Internal curation metadata, not an upstream mirror or user-edited source list.</td></tr>
</table>

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

<table>
  <tr><th>Resource</th><th>Evidence</th></tr>
  <tr><td><code>context://project-index</code></td><td>Project fingerprint and file metadata.</td></tr>
  <tr><td><code>context://freshness</code></td><td>Refresh status and changed-file evidence.</td></tr>
  <tr><td><code>context://learning</code></td><td>Validated learning-loop state.</td></tr>
  <tr><td><code>context://obsidian</code></td><td>Vault index and operation receipts when configured.</td></tr>
  <tr><td><code>context://hooks</code></td><td>Hook configuration and audit evidence.</td></tr>
  <tr><td><code>context://commands</code></td><td>Source-derived command map.</td></tr>
  <tr><td><code>context://agent-brief</code></td><td>Bounded first-read generated context.</td></tr>
  <tr><td><code>context://architecture</code></td><td>Bounded generated architecture map.</td></tr>
</table>

Every response includes `record_type`, `authority`, `source`, and `available`
metadata. Missing optional artifacts return an unavailable result; writes are
not exposed by this capability.
