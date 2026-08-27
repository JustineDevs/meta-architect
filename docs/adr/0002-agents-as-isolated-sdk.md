# ADR 0002: `@jstn-sdk/agents` as Isolated Core SDK

**Status:** Accepted  
**Date:** 2026-08-22  
**Author:** justinedevs  
**Deciders:** justinedevs

### Context

Meta-Architect needs a reusable compatibility layer that any tool can use, not just Meta-Architect's CLI. The question is: should the adapter/compiler logic live inside Meta-Architect, or be extracted as a standalone SDK?

Key constraints:
- Must be usable by any project, not just Meta-Architect
- Must support detection, compilation, and validation
- Must have a plugin/adapters registry for extensibility
- Must be published separately on npm
- Must not include CLI or workflow opinions

### Decision

We will extract the core compatibility logic into **`@jstn-sdk/agents`**, a standalone SDK published separately on npm.

The SDK provides three pure functions:
- `Agents.detect(root)` — detect agent environments
- `Agents.compile(manifest, options)` — compile to native files
- `Agents.validate(root)` — validate generated files

It includes a plugin registry for community adapters and ships with the top 10 built-in adapters (Cursor, Codex, Claude Code, Pi, OpenClaw, Hermes, Copilot, Cline, Gemini, generic).

### Consequences

**Positive:**
- Reusable by any tool, CLI, or library
- Clean separation of concerns: SDK (compatibility) vs. CLI (workflows)
- Community can contribute adapters without touching Meta-Architect
- Published independently with its own versioning
- No runtime dependencies — pure TypeScript library

**Negative:**
- Additional package to maintain and version
- Must keep SDK and CLI versions in sync
- Slightly more complex monorepo structure

**Neutral:**
- Meta-Architect CLI becomes a thin wrapper around the SDK
- Other projects can build their own tools on top of the SDK

