# Security Policy

## Supported versions

Security fixes are developed against the latest release on `main`. The
published npm package is versioned independently from development snapshots.
Users should upgrade to the latest stable `@jstn-sdk/ma` release before
reporting a vulnerability.

## Reporting a vulnerability

Do not open a public issue for an undisclosed vulnerability.

Use GitHub's private security advisory flow:

- [Report a private vulnerability](https://github.com/JustineDevs/meta-architect/security/advisories/new)

If the advisory flow is unavailable, contact `justinedevs@jstn.site` with:

- a concise description of the impact;
- affected versions and runtime/OS details;
- reproducible steps or a minimal proof of concept;
- whether the issue exposes secrets, local paths, or user data; and
- a suggested severity if known.

Please do not include live credentials or private user data. Redact tokens,
keys, cookies, authorization headers, and absolute home-directory paths before
sending evidence.

## Response and disclosure

Maintainers acknowledge private reports as soon as practical, investigate the
report, and coordinate a fix, release, and public advisory with the reporter.
The public advisory or release note identifies the affected versions, impact,
fix, and upgrade path when disclosure is appropriate. We do not promise a
fixed response time that the project cannot substantiate.

Security fixes are tracked privately until a patched release is available.
Public release notes must identify security-relevant fixes without publishing
exploit details that would endanger users before the fix is available.

## Security controls

Pull requests and releases run the repository's automated checks, including:

- GitHub CodeQL analysis for JavaScript and TypeScript;
- dependency and secret-scanning workflows where enabled by the repository;
- Biome lint and formatting checks;
- the full Node.js test suite;
- live regression checks for release tags; and
- package, checksum, SBOM, and release-asset validation.

See the [OpenSSF evidence matrix](./docs/ossf-best-practices.md) for the
current control-to-file and control-to-workflow mapping. A control is not
claimed as complete there unless its evidence is public and reproducible.

## Scope

Meta-Architect is a local workflow and package-distribution tool. It does not
store application passwords, operate a hosted user database, or implement a
custom cryptographic protocol. Reports involving a consuming project should
also be sent to that project's security contact.
