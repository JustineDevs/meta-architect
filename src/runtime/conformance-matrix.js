import { expertLanes } from "./expert-lanes.js";
import { agentRegistry as vendorRegistry } from "./skills-registry-export.js";

const helperLanes = [
  [
    "align",
    "alignment and drift recovery",
    ["runtime-state", "lane-receipts"],
    ["alignment-report", "recovery-plan"],
    "read-only runtime state",
    "src/runtime/alignment-sentinel.js",
    "test/alignment-sentinel.test.js",
  ],
  [
    "diagnose",
    "failure diagnosis and remediation",
    ["failure-receipts", "project-context"],
    ["diagnosis", "repair-plan"],
    "read-only evidence plus managed repair plan",
    "src/runtime/architect-review.js",
    "test/doctor-report.test.js",
  ],
  [
    "tdd",
    "test-first delivery",
    ["task-contract", "acceptance-scenarios"],
    ["test-plan", "test-receipt"],
    "test files only when execution contract permits",
    "src/runtime/ralph-execution-core.js",
    "test/ralph-execution-core.test.js",
  ],
  [
    "cleanup",
    "bounded state and artifact maintenance",
    ["runtime-state", "retention-policy"],
    ["cleanup-receipt", "retention-report"],
    "managed .ma runtime paths only",
    "src/runtime/runtime-state.js",
    "test/runtime-state.test.js",
  ],
  [
    "maestro",
    "autonomous lane selection and dispatch",
    ["task-contract", "lane-receipts", "release-state"],
    ["manager-run", "dispatch-receipt", "completion-decision"],
    "workspace mutations only through task executor",
    "src/runtime/maestro-manager.js",
    "test/full-flow.test.js",
  ],
];

const subsystemDefinitions = [
  [
    "task-queue",
    "$maestro",
    ["CLI, JSON, YAML, stdin"],
    ["durable task queue", "task status events"],
    "`.ma/tasks` and runner leases",
    "task queue receipt",
    "src/runtime/autonomous-tasks.js",
    "test/autonomous-tasks.test.js",
    "not-applicable",
  ],
  [
    "workspace-executor",
    "$build",
    ["execution contract"],
    ["file changes", "verification result", "rollback evidence"],
    "absolute workspace root plus declared relative paths",
    "workspace execution receipt",
    "src/runtime/task-executor.js",
    "test/task-executor.test.js",
    "requires selected vendor runtime only for provider work",
  ],
  [
    "project-context",
    "$arch",
    ["repository files, package metadata, git"],
    ["fingerprint", "agent brief", "authority metadata"],
    "read-only repository scan and `.ma/context`",
    "context refresh receipt",
    "src/runtime/project-context.js",
    "test/project-context.test.js",
    "not-applicable",
  ],
  [
    "source-registry",
    "$sage",
    ["pinned source registry"],
    ["source locks", "claim receipts", "blockers"],
    "read-only registry and evidence cache",
    "source verification receipt",
    "src/runtime/source-registry.js",
    "test/schema-migrations.test.js",
    "requires live source probe when configured",
  ],
  [
    "mcp-policy",
    "$vet",
    ["MCP manifests and policy"],
    ["findings", "authority decisions"],
    "read-only manifests; guarded MCP writes",
    "MCP policy receipt",
    "src/runtime/mcp-policy.js",
    "test/mcp-policy.test.js",
    "requires configured MCP server",
  ],
  [
    "mcp-authority",
    "$vet",
    ["tool call plus authority metadata"],
    ["allow/refuse decision", "audit receipt"],
    "MCP tool boundary only",
    "MCP authority receipt",
    "src/runtime/mcp-authority.js",
    "test/mcp-authority.test.js",
    "requires live MCP client",
  ],
  [
    "code-intel",
    "$vet",
    ["repository paths and gitignore"],
    ["bounded code graph", "scan findings"],
    "read-only, gitignored, binary-filtered paths",
    "code-intel receipt",
    "src/runtime/mcp-code-intel.js",
    "test/mcp-code-intel.test.js",
    "not-applicable",
  ],
  [
    "obsidian",
    "$vibe",
    ["vault configuration and note operations"],
    ["vault context", "note receipts", "queue decisions"],
    "configured vault root with traversal and symlink guards",
    "Obsidian operation receipt",
    "src/runtime/obsidian-integration-core.js",
    "test/obsidian-integration-core.test.js",
    "requires configured vault",
  ],
  [
    "continuity-graph",
    "$flow",
    ["learning, handoff, and vault notes"],
    ["nodes", "edges", "continuity packet"],
    "managed graph namespace; source notes remain authoritative",
    "graph receipt",
    "src/runtime/continuity-graph.js",
    "test/graphify-core.test.js",
    "not-applicable",
  ],
  [
    "learning-loop",
    "$flow",
    ["work outcome and verification evidence"],
    ["learning record", "failure memory", "preference memory"],
    "`.ma/memory` managed records",
    "learning receipt",
    "src/runtime/learning-loop-core.js",
    "test/learning-loop-core.test.js",
    "not-applicable",
  ],
  [
    "redaction",
    "$vet",
    ["provider-bound text and local secrets"],
    ["redacted payload", "vault mapping"],
    "provider boundary plus owner-only redaction vault",
    "redaction receipt",
    "src/runtime/redaction-gateway.js",
    "test/redaction-gateway.test.js",
    "not-applicable",
  ],
  [
    "quality",
    "$vet",
    ["generated code and project quality rules"],
    ["violations", "quality score", "KPI receipt"],
    "read-only scan plus `.ma/quality` records",
    "quality receipt",
    "src/quality/ai-quality-orchestrator.js",
    "test/ai-quality-orchestrator.test.js",
    "depends on configured scanners",
  ],
  [
    "agent-distribution",
    "$maestro",
    ["canonical skills and selected targets"],
    ["native or portable skill artifacts"],
    "selected project/global skill roots only",
    "distribution receipt",
    "src/runtime/skills-registry-export.js",
    "test/skills-registry-export.test.js",
    "distribution proof only unless host probe passes",
  ],
  [
    "plugin-broker",
    "$maestro",
    ["plugin manifest and installed hosts"],
    ["plugin artifacts", "MCP config patch", "rollback receipt"],
    "declared host config paths with atomic rollback",
    "plugin broker receipt",
    "src/runtime/universal-plugin-broker-core.js",
    "test/universal-plugin-broker-core.test.js",
    "requires installed host for runtime proof",
  ],
  [
    "live-agent-verification",
    "$maestro",
    ["target registry and safe version probes"],
    ["runtime/distribution/blocked report"],
    "isolated temporary verification directory",
    "live verification report",
    "src/runtime/live-agent-verification.js",
    "test/package-exports.test.js",
    "actual host command and authentication required",
  ],
  [
    "codex-app-server",
    "$maestro",
    ["JSON-RPC thread and turn events"],
    ["typed lifecycle events", "approval decisions"],
    "Codex app-server process boundary",
    "app-server session receipt",
    "src/runtime/codex-app-server.js",
    "test/codex-app-server.test.js",
    "Codex binary and auth required",
  ],
  [
    "pi-maestro",
    "$maestro",
    ["Pi tool events and lane mapping"],
    ["guarded tool dispatch", "lane receipts"],
    "Pi extension/tool boundary",
    "Pi Maestro receipt",
    "src/runtime/pi-maestro-core.js",
    "test/pi-maestro-core.test.js",
    "Pi runtime required",
  ],
  [
    "prelaunch",
    "$maestro",
    ["installed host markers and user selection"],
    ["selected host", "installation scope", "compatibility entrypoint"],
    "selected project/global installation roots",
    "prelaunch receipt",
    "src/prelaunch.js",
    "test/prelaunch.test.js",
    "host runtime required for execution",
  ],
  [
    "runtime-state",
    "$cleanup",
    ["managed runtime records"],
    ["atomic state", "locks", "retention result"],
    "`.ma` managed runtime directories",
    "runtime state receipt",
    "src/runtime/runtime-state.js",
    "test/runtime-state.test.js",
    "not-applicable",
  ],
  [
    "release-gates",
    "$build",
    ["lane receipts, issue evidence, package metadata"],
    ["release readiness", "merge/release decision"],
    "release state and evidence files only",
    "release gate receipt",
    "src/release-issue-gates.js",
    "test/release-issue-gates.test.js",
    "CI and repository credentials required for external release",
  ],
  [
    "disk-fixtures",
    "$cleanup",
    ["test fixture declarations"],
    ["bounded fixture", "cleanup/compression report"],
    "isolated `/tmp/ma-tests` namespace",
    "fixture cleanup receipt",
    "src/test-fixtures.js",
    "test/test-fixtures.test.js",
    "not-applicable",
  ],
];

function entry({
  id,
  category,
  owner,
  inputs,
  outputs,
  mutationBoundary,
  receipt,
  test,
  liveRuntimeProof,
}) {
  return {
    id,
    category,
    owner,
    inputs,
    outputs,
    mutation_boundary: mutationBoundary,
    receipt,
    test,
    live_runtime_proof: liveRuntimeProof,
  };
}

function laneEntry(lane) {
  return entry({
    id: lane.id,
    category: "expert-lane",
    owner: `$${lane.id}`,
    inputs: lane.inputs,
    outputs: lane.outputs,
    mutationBoundary:
      lane.id === "build"
        ? "declared workspace task executor"
        : "read-only lane state and owned receipts",
    receipt: "expert_lane_receipt",
    test: "test/expert-lanes.test.js",
    liveRuntimeProof: "lane dispatch proof; vendor runtime not implied",
  });
}

function helperEntry([id, _domain, inputs, outputs, mutationBoundary, source, test]) {
  return entry({
    id,
    category: "support-lane",
    owner: `$${id}`,
    inputs,
    outputs,
    mutationBoundary,
    receipt: `${id}-receipt`,
    test,
    liveRuntimeProof: `source: ${source}; live vendor runtime not implied`,
  });
}

function subsystemEntry([
  id,
  owner,
  inputs,
  outputs,
  mutationBoundary,
  receipt,
  source,
  test,
  liveRuntimeProof,
]) {
  return entry({
    id,
    category: "subsystem",
    owner,
    inputs,
    outputs,
    mutationBoundary,
    receipt,
    test,
    liveRuntimeProof: `${liveRuntimeProof}; source: ${source}`,
  });
}

function vendorEntry([id, target]) {
  return entry({
    id,
    category: "vendor-surface",
    owner: "$maestro",
    inputs: ["canonical skills payload", "selected host target"],
    outputs: [
      target.native_artifacts?.map((artifact) => artifact.path).join(", ") || target.skillsDir,
    ],
    mutationBoundary: `selected project target root and ${target.skillsDir}`,
    receipt: "cross_agent_install_verification",
    test: "test/skills-registry-export.test.js",
    liveRuntimeProof:
      "distribution verified; runtime proof requires verify --agents-live and installed host",
  });
}

export function createConformanceMatrix({ liveReport = null } = {}) {
  const liveByTarget = new Map(
    (liveReport?.results ?? []).map((result) => [result.target, result]),
  );
  const vendorEntries = Object.entries(vendorRegistry).map(([id, target]) => {
    const result = vendorEntry([id, target]);
    const live = liveByTarget.get(id);
    if (live)
      result.live_runtime_proof = `${live.status}${live.version ? ` (${live.version})` : ""}${live.reason ? `: ${live.reason}` : ""}`;
    return result;
  });
  const entries = [
    ...expertLanes.map(laneEntry),
    ...helperLanes.map(helperEntry),
    ...subsystemDefinitions.map(subsystemEntry),
    ...vendorEntries,
  ];
  return validateConformanceMatrix({
    schemaVersion: "1.0.0",
    record_type: "meta_architect_conformance_matrix",
    generated_at: new Date().toISOString(),
    policy: {
      distribution_does_not_imply_runtime: true,
      runtime_proof_requires_host_probe: true,
      production_proof_requires_external_evidence: true,
    },
    counts: {
      expert_lanes: expertLanes.length,
      support_lanes: helperLanes.length,
      subsystems: subsystemDefinitions.length,
      vendor_surfaces: vendorEntries.length,
      total: entries.length,
    },
    entries,
  });
}

export function validateConformanceMatrix(matrix) {
  if (
    matrix?.schemaVersion !== "1.0.0" ||
    matrix.record_type !== "meta_architect_conformance_matrix"
  ) {
    throw new Error("invalid Meta-Architect conformance matrix schema");
  }
  if (!Array.isArray(matrix.entries) || matrix.entries.length === 0) {
    throw new Error("conformance matrix requires entries");
  }
  const ids = new Set();
  for (const item of matrix.entries) {
    if (!item.id || ids.has(`${item.category}:${item.id}`))
      throw new Error(`duplicate conformance entry: ${item.category}:${item.id}`);
    ids.add(`${item.category}:${item.id}`);
    for (const field of ["owner", "mutation_boundary", "receipt", "test", "live_runtime_proof"]) {
      if (typeof item[field] !== "string" || !item[field].trim())
        throw new Error(`${item.id}.${field} is required`);
    }
    for (const field of ["inputs", "outputs"]) {
      if (!Array.isArray(item[field]) || item[field].length === 0)
        throw new Error(`${item.id}.${field} must be non-empty`);
    }
  }
  return matrix;
}
