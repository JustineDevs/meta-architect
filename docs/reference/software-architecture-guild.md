# Software Architecture Guild reference

Meta-Architect uses the Software Architecture Guild’s architecture-style
catalog as a reference for the `$arch` lane. It is a decision aid, not a rule
that forces every project into a fashionable architecture.

## Default `$arch` behavior

For each architecture brief, `$arch` considers the applicable styles and
records why the selected style fits the project’s requirements, team context,
operational constraints, and expected evolution:

<table>
  <tr><th>Family</th><th>Styles considered</th><th>Typical decision concern</th></tr>
  <tr><td>Monolithic</td><td>Layered, modular, pipeline, microkernel</td><td>Delivery speed, boundaries, extensibility, and operational simplicity</td></tr>
  <tr><td>Distributed</td><td>Service-oriented, event-driven, space-based, orchestration-driven, microservices</td><td>Scale, independent evolution, coordination, consistency, and operational cost</td></tr>
</table>

The lane must select the simplest applicable style or composition, state the
quality attributes driving the choice, record rejected alternatives, and cite
the source receipt. The catalog does not unlock evidence by itself; `$sage`
still verifies source identity, content match, commit pin, and license claims.

## Attribution and source lock

The reference was cloned from
[`software-architecture-guild/software-architecture-guild.github.io`](https://github.com/software-architecture-guild/software-architecture-guild.github.io)
at commit `38f3b13ec0a99e95d4ddb721b53026e828653ab5` for inspection. The
repository is MIT-licensed; see its [LICENSE](https://github.com/software-architecture-guild/software-architecture-guild.github.io/blob/main/LICENSE).

The runtime source registry maps the repository to its exact GitMCP endpoint:

`https://gitmcp.io/software-architecture-guild/software-architecture-guild.github.io`

Primary guide: [Architecture Styles](https://software-architecture-guild.com/guide/architecture/fundamentals/architecture-styles/).
The guide describes the styles, their tradeoffs, and selection factors such as
requirements, team capability, scalability, operational complexity, existing
systems, and maintainability.
