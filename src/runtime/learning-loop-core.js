import { ensureDir, readJson, writeFileIfMissing } from "../fs-utils.js";
import { getRuntimeSubsystemPath } from "../paths.js";

export const learningLoopCoreSchemaVersion = "0.1.0";

export const learningLoopDomains = [
  "core_orchestration",
  "memory_knowledge",
  "intelligence_learning",
  "code_quality_testing",
  "security_compliance",
  "architecture_methodology",
  "devops_observability",
  "extensibility",
  "domain_specific",
];

export function getLearningLoopCorePath() {
  return getRuntimeSubsystemPath("context", "learning-loop-core.json");
}

export function createDefaultLearningLoopCore() {
  return {
    schemaVersion: learningLoopCoreSchemaVersion,
    product: "Meta-Architect",
    purpose:
      "First-party learning loop that turns verified workspace outcomes into durable, lane-aware improvements over time.",
    loop: {
      cadence: "every_verified_workflow_or_release_gate",
      sequence: [
        "observe_runtime_outcome",
        "classify_learning_domain",
        "record_semantic_receipt",
        "promote_verified_learning",
        "apply_to_next_run",
        "verify_effectiveness_delta",
      ],
      fail_closed_rule:
        "Unverified observations stay as candidate learnings and must not change gates, release state, or durable policy.",
    },
    domains: [
      {
        id: "core_orchestration",
        label: "Core & Orchestration",
        learns_from: ["maestro_runs", "lane_handoffs", "manager_events"],
        writes_to: [".ma/state/manager-runs.json", ".ma/context/workspace-effectiveness.json"],
        promotion_gate: "handoff_replay_or_release_check_passed",
      },
      {
        id: "memory_knowledge",
        label: "Memory & Knowledge",
        learns_from: ["memory_notes", "obsidian_vault_context", "semantic_receipts"],
        writes_to: [".ma/memory/notes.md", ".ma/memory/index.json", ".ma/context/project.md"],
        promotion_gate: "source_provenance_and_authority_boundary_verified",
      },
      {
        id: "intelligence_learning",
        label: "Intelligence & Learning",
        learns_from: ["prompt_strategy_results", "context_budget_outcomes", "rehearsal_traces"],
        writes_to: [".ma/context/prompt-strategy-core.json", ".ma/context/learning-loop-core.json"],
        promotion_gate: "strategy_result_has_verification_delta",
      },
      {
        id: "code_quality_testing",
        label: "Code Quality & Testing",
        learns_from: ["test_failures", "lint_results", "build_results", "ralph_progress"],
        writes_to: [".ma/specs/logic.md", ".ma/plans/build.md"],
        promotion_gate: "fresh_test_or_build_evidence_passed",
      },
      {
        id: "security_compliance",
        label: "Security & Compliance",
        learns_from: ["vet_findings", "exposure_catalog", "redaction_receipts"],
        writes_to: [".ma/specs/security.md", ".ma/evidence/audits.json"],
        promotion_gate: "security_review_passed_or_blocker_preserved",
      },
      {
        id: "architecture_methodology",
        label: "Architecture & Methodology",
        learns_from: ["architecture_decisions", "methodology_reviews", "tradeoff_outcomes"],
        writes_to: [".ma/specs/architecture.md", ".ma/decisions.json"],
        promotion_gate: "architecture_review_accepts_reusable_pattern",
      },
      {
        id: "devops_observability",
        label: "DevOps & Observability",
        learns_from: ["release_checks", "package_smokes", "runtime_traces", "hook_audits"],
        writes_to: [".ma/runbook.md", ".ma/logs/", ".ma/hooks/audit.log"],
        promotion_gate: "release_or_smoke_gate_passed",
      },
      {
        id: "extensibility",
        label: "Extensibility",
        learns_from: ["skill_exports", "plugin_installs", "mcp_policy_results", "host_payloads"],
        writes_to: [".ma/context/skills-registry-export.json", "mcp/servers.json"],
        promotion_gate: "compatibility_matrix_verified",
      },
      {
        id: "domain_specific",
        label: "Domain-Specific",
        learns_from: ["workspace_stack", "project_domain_notes", "trusted_sources"],
        writes_to: [
          ".ma/context/workspace-context-pack.json",
          ".ma/evidence/semantic-receipts.json",
        ],
        promotion_gate: "domain_claim_has_source_or_user_authority",
      },
    ],
    learning_record_schema: {
      domain: "one_of_learningLoopDomains",
      claim: "string",
      source: "path_or_runtime_surface",
      evidence: ["path_or_command_or_receipt"],
      status: "candidate | verified | rejected | superseded",
      applies_to: ["agent_or_role_or_lane"],
      cannot_mutate: ["release_state_without_owning_lane", "source_evidence", "security_boundary"],
      next_verification: "string",
    },
    hard_rules: [
      "Learning records require domain, claim, source, evidence, status, applies_to, and next_verification.",
      "Candidate learnings can inform context but cannot mutate gates, release state, or durable policy.",
      "Verified learnings must preserve lane authority and semantic channel boundaries.",
      "Obsidian and memory context can inform planning but do not become build evidence without owning-lane promotion.",
      "Security, compliance, redaction, and irreversible-action warnings must not be compressed or auto-promoted.",
    ],
    records: [],
  };
}

export function validateLearningLoopCore(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("learning loop core must be an object");
  }
  if (value.schemaVersion !== learningLoopCoreSchemaVersion) {
    throw new Error(`Unsupported learning loop core schemaVersion: ${value.schemaVersion}`);
  }
  if (!Array.isArray(value.domains) || value.domains.length !== learningLoopDomains.length) {
    throw new Error("learning loop core must include every required learning domain");
  }
  const ids = new Set(value.domains.map((domain) => domain.id));
  for (const required of learningLoopDomains) {
    if (!ids.has(required)) {
      throw new Error(`learning loop core missing domain: ${required}`);
    }
  }
  for (const domain of value.domains) {
    if (
      typeof domain.label !== "string" ||
      !Array.isArray(domain.learns_from) ||
      !Array.isArray(domain.writes_to) ||
      typeof domain.promotion_gate !== "string"
    ) {
      throw new Error(
        "learning loop domains require label, learns_from, writes_to, and promotion_gate",
      );
    }
  }
  if (!Array.isArray(value.records)) {
    throw new Error("learning loop core requires records array");
  }
  if (JSON.stringify(value).includes(".omx")) {
    throw new Error("learning loop core must not expose OMX runtime paths");
  }
  return value;
}

export function createLearningRecord({
  domain,
  claim,
  source,
  evidence = [],
  status = "candidate",
  appliesTo = ["all_applicable_agents", "all_applicable_roles"],
  nextVerification,
}) {
  if (!learningLoopDomains.includes(domain)) {
    throw new Error(`Unsupported learning domain: ${domain}`);
  }
  if (!claim || !source || !nextVerification) {
    throw new Error("Learning record requires domain, claim, source, and nextVerification");
  }
  return {
    domain,
    claim,
    source,
    evidence: evidence.filter((entry) => typeof entry === "string" && entry.trim()),
    status,
    applies_to: appliesTo.filter((entry) => typeof entry === "string" && entry.trim()),
    cannot_mutate: ["release_state_without_owning_lane", "source_evidence", "security_boundary"],
    next_verification: nextVerification,
    created_at: new Date().toISOString(),
  };
}

export function addLearningRecord(core, record) {
  const validated = validateLearningLoopCore(core);
  if (!learningLoopDomains.includes(record.domain)) {
    throw new Error(`Unsupported learning domain: ${record.domain}`);
  }
  if (!["candidate", "verified", "rejected", "superseded"].includes(record.status)) {
    throw new Error(`Unsupported learning record status: ${record.status}`);
  }
  return validateLearningLoopCore({
    ...validated,
    records: [...validated.records, record],
  });
}

export function evaluateLearningLoopReadiness(core) {
  const validated = validateLearningLoopCore(core);
  const coveredDomains = new Set(validated.domains.map((domain) => domain.id));
  const verifiedDomains = new Set(
    validated.records
      .filter((record) => record.status === "verified")
      .map((record) => record.domain),
  );

  return {
    record_type: "learning_loop_readiness",
    ready: learningLoopDomains.every((domain) => coveredDomains.has(domain)),
    domains: learningLoopDomains.length,
    verified_domains: verifiedDomains.size,
    candidate_records: validated.records.filter((record) => record.status === "candidate").length,
    promotion_rule: validated.loop.fail_closed_rule,
  };
}

export async function seedLearningLoopCoreArtifacts() {
  await ensureDir(getRuntimeSubsystemPath("context"));
  await writeFileIfMissing(
    getLearningLoopCorePath(),
    `${JSON.stringify(createDefaultLearningLoopCore(), null, 2)}\n`,
  );
}

export async function loadLearningLoopCore() {
  return validateLearningLoopCore(await readJson(getLearningLoopCorePath()));
}
