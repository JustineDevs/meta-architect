# Conformance Matrix

Meta-Architect treats a lane, subsystem, and vendor surface as a separate conformance target. A target is not considered runtime-verified merely because its skill files can be distributed.

Run the matrix locally:

```bash
ma conformance --json
```

Run it with safe host version probes:

```bash
ma conformance --live --json
```

Each entry contains these required fields:

| Field | Meaning |
| --- | --- |
| `owner` | The lane or authority that owns the behavior |
| `inputs` | Evidence and contracts consumed |
| `outputs` | Artifacts or decisions produced |
| `mutation_boundary` | Filesystem or external boundary it may touch |
| `receipt` | Evidence record required for completion |
| `test` | Regression or conformance test covering the behavior |
| `live_runtime_proof` | What is proven locally and what still requires a real host |

The current matrix contains **88 separate entries**:

- 6 expert lanes: `arch`, `sage`, `flow`, `vet`, `vibe`, `build`
- 5 support lanes: `align`, `diagnose`, `tdd`, `cleanup`, `maestro`
- 22 runtime subsystems
- 55 vendor distribution surfaces

The matrix deliberately records distribution proof separately from runtime proof. A vendor is only runtime-verified when its actual host command is installed, safely probed, and reported by `ma verify --agents-live`. Production evidence remains a separate release requirement.
