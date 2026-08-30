<div align="center">
  <img src="./docs/assets/banner.png" alt="Meta-Architect: quality gates and evidence verification for AI coding agents" width="1000">
  <h1>Meta-Architect</h1>
  <p><strong>Quality gates and evidence verification for AI coding agents.</strong></p>
  <p>Your agent writes code fast. Meta-Architect makes it prove each stage first. Design, evidence, logic, security, experience, build. Each gate stays locked until the one before it passes.</p>
  <p>
    <img src="https://img.shields.io/github/v/release/JustineDevs/meta-architect?display_name=tag&sort=semver" alt="GitHub release">
    <img src="https://img.shields.io/npm/v/%40jstn-sdk%2Fma" alt="npm version">
    <a href="https://github.com/users/JustineDevs/packages?repo_name=meta-architect">
      <img src="https://img.shields.io/badge/GitHub%20Packages-%40jstn--sdk%2Fma-181717?logo=github" alt="GitHub Packages">
    </a>
    <img src="https://img.shields.io/npm/dm/%40jstn-sdk%2Fma" alt="npm downloads">
    <a href="https://badge.socket.dev/npm/package/@jstn-sdk/ma/0.14.1">
      <img src="https://badge.socket.dev/npm/package/@jstn-sdk/ma/0.14.1" alt="Socket security">
    </a>
    <a href="https://security.snyk.io/package/npm/%252540jstn-sdk%25252Fma">
      <img src="https://snyk.io/test/npm/%40jstn-sdk%2Fma/badge.svg" alt="Snyk security">
    </a>
    <a href="https://www.buymeacoffee.com/justinedevs">
      <img src="https://img.shields.io/badge/Buy%20Me%20A%20Coffee-ffdd00?style=flat-square&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me A Coffee">
    </a>
    <a href="https://github.com/sponsors/JustineDevs">
      <img src="https://img.shields.io/badge/GitHub%20Sponsors-JustineDevs-1f6feb?style=flat-square&logo=githubsponsors&logoColor=white" alt="GitHub Sponsors">
    </a>
  </p>
  <p><a href="#quick-start">Quick Start</a> · <a href="./DEMO.md">Demo</a> · <a href="./COVERAGE.md">Verified Coverage</a> · <a href="#how-do-i-contribute">Contributing</a> · <a href="https://github.com/JustineDevs/meta-architect/issues">Issues</a></p>
</div>

> [!NOTE]
> Meta-Architect is a workflow layer for teams that want architecture, evidence, review, and release discipline before build execution.
> Meta-Architect does not replace your coding runtime.
> It wraps that runtime with architecture, evidence, gate enforcement, and release-sensitive workflow control.

<img src="https://raw.githubusercontent.com/JustineDevs/meta-architect/v0.14.1/docs/assets/DEMO_VIDEO.gif" alt="Meta-Architect demo video" width="800">

## 🧩 Quick start

| ✅ Recommended | 🧰 All available installation commands |
| --- | --- |
| Use the signed jsDelivr installer on macOS, Linux, WSL, or Git Bash.<br><br>`curl -fsSLo install.sh https://cdn.jsdelivr.net/gh/JustineDevs/meta-architect@latest/scripts/install.sh`<br><br>`curl -fsSLo install.sh.sha256 https://cdn.jsdelivr.net/gh/JustineDevs/meta-architect@latest/scripts/install.sh.sha256`<br><br>`sed 's#scripts/install.sh#install.sh#' install.sh.sha256 \| sha256sum -c -`<br><br>`sh install.sh`<br><br>`ma --madmax --high`<br><br>`$maestro I want to build: [your project idea]` | **npm global**<br><br>`npm i -g @openai/codex@latest @jstn-sdk/ma@latest`<br><br>**Meta-Architect only**<br><br>`npm i -g @jstn-sdk/ma@latest`<br><br>**Windows PowerShell**<br><br>`npm i -g @openai/codex@latest @jstn-sdk/ma@latest`<br><br>**Debian / Ubuntu**<br><br>`sudo apt install ./meta-architect_&lt;version&gt;_all.deb`<br><br>**Arch Linux**<br><br>`sudo pacman -U ./meta-architect-&lt;version&gt;-1-any.pkg.tar.xz`<br><br>**Fedora / openSUSE**<br><br>`sudo dnf install ./meta-architect-&lt;version&gt;-1.noarch.rpm` |

### AI agent installation prompt

Copy and paste this prompt into your AI coding agent:

```text
Install Meta-Architect for this project.

1. Detect the current AI host and its native project configuration surface.
2. Install or update `@jstn-sdk/ma@latest` using the host's supported package manager.
3. Set `MA_AGENT` to the detected host ID when a host-specific surface is available.
4. Run `ma setup` and accept the detected project scope and targets.
5. Verify the generated `.ma/` state and native host artifacts.
6. Report the installed version, selected host, generated files, and any unsupported capabilities.

Do not overwrite user-owned files, modify unrelated configuration, or claim a host is supported without verification.
```

More install options: [docs/getting-started.md](./docs/getting-started.md)

Uninstall Meta-Architect: `npm uninstall -g @jstn-sdk/ma`
Uninstall Meta-Architect and Codex: `npm uninstall -g @jstn-sdk/ma @openai/codex`

### Install into an AI vendor host

Install Meta-Architect once, then select the host surface before launch. The
pre-launch step detects installed hosts and writes the selected scope and
targets to `.ma/prelaunch.json`.

```bash
# Codex (reference host)
npm i -g @openai/codex@latest @jstn-sdk/ma@latest
ma --madmax --high

# Claude Code
MA_AGENT=claude-code npm i -g @jstn-sdk/ma@latest
MA_AGENT=claude-code ma --madmax --high

# Cursor
MA_AGENT=cursor npm i -g @jstn-sdk/ma@latest
MA_AGENT=cursor ma --madmax --high

# Any registered host surface
MA_AGENT=<host-id> npm i -g @jstn-sdk/ma@latest
MA_AGENT=<host-id> ma --madmax --high
```

MA installs or reuses the native skill/configuration surface for the selected
host and keeps the canonical workflow unchanged. See the [host compatibility
evidence](./docs/agent-compat-integration-report.md) for supported surfaces.

### Claude Code marketplace

The repository includes a hosted Claude Code marketplace for the existing
`plugins/meta-architect` bundle:

```text
/plugin marketplace add JustineDevs/meta-architect
/plugin install meta-architect@meta-architect
```

<details>
<summary><strong>🔌 All 33 plugins & features</strong></summary>

The plugin and feature inventory is maintained in the [support bundle manifest](./support-bundle.json) and [skills manifest](./skills/index.json), with verification in the [coverage documentation](./COVERAGE.md).
</details>

<details>
<summary><strong>Why do AI coding agents need gates?</strong></summary>

Your agent writes code faster than you review it. Studies and dev surveys keep finding the same failures:

- Plausible code with wrong logic
- Imports of packages which don't exist
- Outdated APIs from training cutoffs
- "Done" claims with zero proof

Meta-Architect blocks each one:

- No architecture without a decision record. `$arch` writes the blueprint and the trade-offs.
- No stack claims without evidence. `$sage` grades every dependency claim VERIFIED, PARTIAL, or MISSING against upstream repos through GitMCP.
- No build while a gate is red. Logic, security, and DX reviews fail closed.
- No release claims without proof. Releases need issue-linked, production-verified evidence.

## What is Meta-Architect?

An open-source workflow governor for AI coding agents. You install it as a skill package in your agent host. It adds six gated lanes plus `$maestro`, a bounded manager which routes your work through them. It doesn't replace your agent, runtime, or model. It governs what they produce.

| Fact | Value |
| --- | --- |
| Type | Skill and plugin package for AI coding agent hosts |
| Reference host | Codex (full support) |
| Compatibility scope | Codex, OpenCode, Gemini CLI, Amp, Claude Code, Goose, Hermes, Pi, Cursor, Windsurf, Cline, Continue, Roo, Kiro CLI, Junie, GitHub Copilot, and Antigravity ([coverage evidence](./docs/agent-compat-integration-report.md)) |
| Runtime | Node.js 20+ |
| Install | `npm i -g @jstn-sdk/ma` |
| Evidence sources | GitMCP / MCP endpoints |
| License | MIT |

## How does it work?

State your intent once. `$maestro` picks the next safe step and stops when something fails.

```text
$maestro I want to build: a multi-tenant analytics API for logistics customers
```

```text
Meta-Architect Status
=====================
Idea: CLEAR
Architecture: APPROVED
Evidence: VERIFIED
Logic: GREEN
Security: GREEN
Experience: GREEN
Build: LOCKED
```

Build stays LOCKED until every upstream gate passes. Red stays red.

## The six gates

| Lane | Question it answers | Gate |
| --- | --- | --- |
| `$arch` | What are you building, and why this shape? | architecture_status |
| `$sage` | Do your stack choices trace to real upstream evidence? | evidence_status |
| `$flow` | Do the logic and state transitions hold? | logic_status |
| `$vet` | Does it survive security and dependency review? | security_status |
| `$vibe` | Will developers and users tolerate it? | experience_status |
| `$build` | What's the narrowest safe thing to build now? | build_status |

Four helpers support the lanes without moving gates: `$align`, `$diagnose`, `$tdd`, `$cleanup`.

### How is it different from Spec Kit, BMAD, or Agent OS?

Spec-driven tools structure what your agent writes. Meta-Architect enforces what your agent proves.

| | Spec Kit | BMAD | Agent OS | Meta-Architect |
| --- | --- | --- | --- | --- |
| Structured workflow | Yes | Yes | Yes | Yes |
| Gates which block | No | No | No | Yes |
| External evidence verification | No | No | No | Yes, GitMCP-graded |
| Learning loop with promotion rules | No | No | No | Yes |
| Multi-host | Yes | Yes | Yes | Codex today, expanding |

Already using a spec tool? Keep it. Their specs become inputs. MA's gates verify the execution.

</details>

## Who is it for?

- Solo builders shipping with AI agents who want release discipline without enterprise process
- OSS contributors who need stack decisions they defend in review
- Skip it if you want an unattended agent writing code. MA governs your agent. It isn't one.

## How do I contribute?

1. Open an issue before a PR. It saves rework.
2. Start here: [issues labeled `triage`](https://github.com/JustineDevs/meta-architect/issues)
3. Branch from `development`. `main` is protected and release-facing.
4. Run `npm test` before you submit. Follow [AGENTS.md](./AGENTS.md).
5. AI-assisted PRs welcome. Explain every line you submit or expect a close.

## Learn more

- [Getting Started](./docs/getting-started.md)
- [Skills Reference](./docs/skills.md)
- [Demo](./DEMO.md)
- [Coverage Matrix](./COVERAGE.md): the proof behind every claim on this page
- [Release Spec](./docs/release-spec.md)
- [Disk-Bounded Test and Review Runs](./docs/disk-optimization.md)
- [MCP Setup](./docs/mcp-setup.md)
- [ChatGPT Integration](./docs/chatgpt-integration.md): deployment requirements and publication boundary

## License

[MIT](./LICENSE). Built by [@JustineDevs](https://github.com/JustineDevs). Shaped by ideas from the `oh-my-codex` ecosystem.

Found a bad claim before it shipped? Star the repo. It helps other developers find it.
