# Technology evidence dossier

`$sage` keeps technology decisions tied to the exact upstream source that can
support them. Reference dossiers help organize a review; they do not approve a
dependency or replace the official documentation for that dependency.

## Default review

For every selected technology, record the exact upstream repository or official
documentation, version or commit, license, maintenance signal, compatibility
constraints, security advisories, operational assumptions, and migration cost.
Separate a source-backed fact from an inference and from the recommendation.

The project context produces `.ma/context/technology-capability-matrix.json`
from the repository's direct dependencies and development dependencies. Each
entries include the requested version range, dependency role, technology
specific variables, capability claims, required evidence claims, and
recommendation status. Project-level environment variables observed in package
scripts are kept once at the matrix root so they are not falsely attributed to
every dependency. Technology-specific variables and capabilities start as
unknown; `$sage` must populate them from official documentation or an approved
upstream source. An entry with missing evidence remains `blocked` and cannot be
presented as a recommendation.
Discovery lists are candidate-finding inputs only. An authoritative or approved
reference source must support every claim that unlocks the evidence gate.

## Reference source

The lane uses the repository-specific sources already listed in the
[source-selection contract](../../skills/sage/references/source-selection.md)
and the pinned source registry at [`mcp/source-registry.json`](../../mcp/source-registry.json).
The registry records the source identity, allowed lanes, required claims, and
GitMCP endpoint. Credit and licensing always remain with each upstream project.
The registry is provenance control, not a substitute for a per-technology
capability record.
