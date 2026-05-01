# Sprint 2: OSS Evidence

## Goal

Bind major architecture choices to approved GitMCP-backed evidence.

## Inputs

- `architecture_status = APPROVED`
- configured MCP/GitMCP endpoints

## Expected outputs

- `.ma/evidence/sources.json`
- `evidence_status = VERIFIED | PARTIAL | MISSING`

## Exit criteria

- at least one real approved source is probed successfully for `VERIFIED`
- all blockers are explicit if evidence is partial or missing

## Failure conditions

- invalid endpoint configuration
- live MCP failure
- no approved source available
