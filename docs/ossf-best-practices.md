# OpenSSF Best Practices Evidence

This document is the repository's evidence map for the [OpenSSF Best Practices
Badge](https://bestpractices.coreinfrastructure.org/en). It is intentionally
conservative: `Met` means the linked repository surface or workflow provides
reproducible evidence; `N/A` means the criterion does not apply to this local
workflow/package tool; `Pending` means the project must gather operational
evidence before selecting `Met` in the OpenSSF form.

The OpenSSF form is a self-certification process. A saved form is not the same
as a security scan, audit, or guarantee.

## Public project information

| Control | Status | Evidence |
| --- | --- | --- |
| Project description, homepage, repository, license | Met | [README](../README.md), [package metadata](../package.json), [MIT license](../LICENSE) |
| Installation and user workflow | Met | [Getting started](./getting-started.md) |
| Contribution process and requirements | Met | [CONTRIBUTING](../CONTRIBUTING.md), [PR template](../.github/PULL_REQUEST_TEMPLATE.md) |
| Support and issue discussion | Met | [GitHub issues](https://github.com/JustineDevs/meta-architect/issues), [issue templates](../.github/ISSUE_TEMPLATE) |
| Security reporting | Met | [SECURITY](../SECURITY.md) |
| Conduct expectations | Met | [CODE_OF_CONDUCT](../CODE_OF_CONDUCT.md) |
| Public interface and behavior reference | Met | [Skills](./skills.md), [CLI setup](./getting-started.md), [coverage matrix](../COVERAGE.md) |
| English documentation and issue intake | Met | Repository documentation and issue templates |

## Change control

| Control | Status | Evidence |
| --- | --- | --- |
| Public version-controlled source | Met | [GitHub repository](https://github.com/JustineDevs/meta-architect) |
| Author and timestamp history | Met | Git commit history and pull requests |
| Review before integration | Met | [PR checks](../.github/workflows/pr-check.yml), [PR template](../.github/PULL_REQUEST_TEMPLATE.md) |
| Distributed version control | Met | Git repository |
| Unique semantic release versions | Met | `package.json`, [release verification](../scripts/release-verify.js) |
| Release tags identify published versions | Met | [GitHub releases](https://github.com/JustineDevs/meta-architect/releases), `v*` release workflow |
| Release notes | Met | [CHANGELOG](../CHANGELOG.md), [release notes](../RELEASE.md) |
| Security-relevant release notes | Met | [SECURITY](../SECURITY.md), [CHANGELOG](../CHANGELOG.md) |

## Reporting and response

| Control | Status | Evidence |
| --- | --- | --- |
| Public bug reporting | Met | [Bug report template](../.github/ISSUE_TEMPLATE/bug_report.yml) |
| Individual issue tracker | Met | [GitHub issues](https://github.com/JustineDevs/meta-architect/issues) |
| Feature request process | Met | [Feature template](../.github/ISSUE_TEMPLATE/feature_request.yml) |
| Release regression reporting | Met | [Release regression template](../.github/ISSUE_TEMPLATE/release_regression.yml) |
| Public report archive | Met | GitHub issue and pull-request history |
| Private vulnerability reporting | Met | [GitHub private advisory flow](https://github.com/JustineDevs/meta-architect/security/advisories/new), [SECURITY](../SECURITY.md) |
| Response-time SLA | Pending | The project does not claim a fixed response-time SLA without measured historical evidence. |

## Build and quality

| Control | Status | Evidence |
| --- | --- | --- |
| Reproducible dependency install | Met | `npm ci`, locked [package-lock.json](../package-lock.json) |
| Standard build/package validation | Met | `npm run release:check`, [release workflow](../.github/workflows/release.yml) |
| Public automated tests | Met | `npm test`, [test directory](../test), [CI](../.github/workflows/ci.yml) |
| Standard test invocation | Met | [CONTRIBUTING](../CONTRIBUTING.md#validate-the-repo) |
| Continuous integration | Met | [CI workflow](../.github/workflows/ci.yml), [PR checks](../.github/workflows/pr-check.yml) |
| New behavior requires tests | Met | [CONTRIBUTING](../CONTRIBUTING.md#pull-requests), PR verification checklist |
| Lint and formatting checks | Met | `npm run check`, Biome configuration, CI |
| Compiler warning policy | N/A | The package is JavaScript-first and does not compile a native codebase. TypeScript artifacts are validated by the applicable package checks. |
| Test suite coverage measurement | Met | `npm run test:coverage`, Node's built-in coverage reporter, and the coverage step in [CI](../.github/workflows/ci.yml) |

## Security practices

| Control | Status | Evidence |
| --- | --- | --- |
| Secure development guidance | Met | [SECURITY](../SECURITY.md), [security playbook](./reference/native-security-playbooks.md) |
| Secret and credential redaction | Met | Runtime redaction tests and [security policy](../SECURITY.md) |
| Static security analysis | Met | [CodeQL workflow](../.github/workflows/codeql.yml) |
| Dependency update process | Met | [Dependabot configuration](../.github/dependabot.yml) |
| Delivery over authenticated transport | Met | npm, GitHub, and jsDelivr URLs use HTTPS |
| Release integrity artifacts | Met | Checksums and SBOM generated by the [release workflow](../.github/workflows/release.yml) |
| Password storage or password hashing | N/A | Meta-Architect does not store user passwords. |
| Custom cryptographic protocol | N/A | Meta-Architect does not implement a cryptographic protocol. |
| Application key agreement or PFS | N/A | No application key-agreement service is implemented. |
| Memory-unsafe native code | N/A | The package is JavaScript/TypeScript and does not ship native memory-unsafe code. |
| Dependency vulnerability gate | Met | `npm audit --omit=dev --audit-level=high` in [CI](../.github/workflows/ci.yml) and Dependabot updates |
| Vulnerability-free release history | Pending | Must be assessed against current advisories and release history; no blanket claim is made here. |

## Analysis and release evidence

| Control | Status | Evidence |
| --- | --- | --- |
| Static analysis before release | Met | CodeQL on pushes, pull requests, and weekly schedule |
| Static analysis on changes | Met | [CodeQL workflow](../.github/workflows/codeql.yml), [CI](../.github/workflows/ci.yml) |
| Runtime/live analysis | Met | `npm run live:regression`, [live regression workflow](../.github/workflows/release.yml) |
| Release package analysis | Met | Package doctor, release checks, checksums, SBOM, Linux package smoke tests |
| Timely remediation process | Met | [SECURITY](../SECURITY.md), release-blocking CI and issue templates |
| Public evidence for current release | Met | [QA evidence](./qa), [coverage matrix](../COVERAGE.md), [CHANGELOG](../CHANGELOG.md) |

## OpenSSF submission guidance

When completing the OpenSSF form:

1. Use the evidence links above for `Met` answers.
2. Select `N/A` only for controls explicitly marked `N/A` here.
3. Leave `Pending` controls unanswered until the project has current,
   reproducible evidence.
4. Do not use this document to claim a response-time SLA, vulnerability-free
   history, or a numerical test-coverage threshold that has not been measured.

The remaining evidence work is operational: record response history and assess
the current advisory history. It is not safe to manufacture those facts in
source control.
