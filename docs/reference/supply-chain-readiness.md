# Supply-chain readiness dossier

`$build` uses SLSA as the default reference when a change packages, publishes,
deploys, or consumes build artifacts. `$vet` uses the same source when reviewing
supply-chain threats; neither lane claims compliance without evidence.

## Default review

Identify the artifact, source revision, builder, dependencies, release identity,
and promotion boundary. Define how provenance is generated, where it is stored,
how consumers verify it, and how a failed verification blocks publication or
deployment. Include rollback, reproducibility, and tamper-detection checks in
the release receipt. Apply only the requirements relevant to the project; do
not inflate a checklist into an unsupported SLSA level.

## Reference source

The pinned reference is the [SLSA specification](https://slsa.dev/spec/v1.2/),
commit `618f5b2192aad8417a8ee8ccb9e3f27d05c0e9b6` through
`https://gitmcp.io/slsa-framework/slsa`. Credit belongs to the SLSA community.
Confirm the applicable version, license, and provenance requirements from the
pinned source before publishing a build or release receipt.
