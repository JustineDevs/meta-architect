# ADR 0001: Meta-Architect as Codex Skills System

**Status:** Accepted  
**Date:** 2026-08-22  
**Author:** justinedevs  
**Deciders:** justinedevs

### Context

Meta-Architect needs to provide a cross-agent development cycle compatibility layer. The question is: should it be a standalone CLI tool, a runtime framework, or a Codex skills package?

Key constraints:
- Must work with existing agent environments (Cursor, Codex, Pi, OpenClaw, etc.)
- Must not be a runtime or execution engine
- Must be installable with one command
- Must remain compatible with Codex natively while supporting other vendors
- Must focus on top-level development cycle, not logic or runtime

### Decision

We will build Meta-Architect as a **Codex skills system** packaged under `@jstn-sdk/meta-architect-skills`, with a thin CLI wrapper (`@jstn-sdk/ma`) for installation and synchronization.

The core compatibility logic will be extracted into a separate SDK (`@jstn-sdk/agents`) that Meta-Architect depends on, but Meta-Architect itself remains a skills package with opinionated workflows.

### Consequences

**Positive:**
- Aligns with existing Codex ecosystem and skill format
- No runtime overhead — skills are declarative Markdown
- Easy installation via `npx @jstn-sdk/ma@latest init`
- Vendor-specific plugins possible through adapter registry
- Clear separation: skills (what to do) vs. SDK (how to compile)

**Negative:**
- Requires Codex-compatible skill loading mechanism
- Less flexible than a full CLI for non-Codex environments
- Must maintain two packages (skills + CLI wrapper)

**Neutral:**
- CLI wrapper (`ma`) is thin and delegates to SDK
- Skills are portable Markdown that other tools can read

