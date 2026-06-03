import { readJson, writeFileIfMissing, writeJson } from "../fs-utils.js";
import { getRuntimeStatePath } from "../paths.js";

const driftRuleDefinitions = [
  {
    skill: "$arch",
    expectedDecisionStatus: "APPROVED",
    releaseField: "architecture_status",
    allowedReleaseValues: ["APPROVED"],
    findingCode: "architecture_status_regressed",
  },
  {
    skill: "$sage",
    expectedDecisionStatus: "VERIFIED",
    releaseField: "evidence_status",
    allowedReleaseValues: ["VERIFIED"],
    findingCode: "evidence_status_regressed",
  },
  {
    skill: "$flow",
    expectedDecisionStatus: "GREEN",
    releaseField: "logic_status",
    allowedReleaseValues: ["GREEN"],
    findingCode: "logic_status_regressed",
  },
  {
    skill: "$vet",
    expectedDecisionStatus: "GREEN",
    releaseField: "security_status",
    allowedReleaseValues: ["GREEN"],
    findingCode: "security_status_regressed",
  },
  {
    skill: "$vibe",
    expectedDecisionStatus: "GREEN",
    releaseField: "experience_status",
    allowedReleaseValues: ["GREEN", "WAIVED"],
    findingCode: "experience_status_regressed",
  },
  {
    skill: "$build",
    expectedDecisionStatus: "DONE",
    releaseField: "build_status",
    allowedReleaseValues: ["DONE"],
    findingCode: "build_status_regressed",
  },
];

export function getAlignmentSentinelPath() {
  return getRuntimeStatePath("alignment-sentinel.json");
}

export function createDefaultAlignmentSentinelReport() {
  return {
    schemaVersion: "0.1.0",
    lastRunAt: null,
    driftStatus: "CLEAR",
    rebootPlanned: false,
    rebootReason: null,
    resumeTrigger: "$maestro",
    baselineArtifacts: [
      ".ma/release.json",
      ".ma/decisions.json",
      ".ma/state/manager-runs.json",
      ".ma/state/maestro-state.json",
    ],
    findings: [],
  };
}

export async function seedAlignmentSentinelArtifacts() {
  await writeFileIfMissing(
    getAlignmentSentinelPath(),
    `${JSON.stringify(createDefaultAlignmentSentinelReport(), null, 2)}\n`,
  );
}

export async function loadAlignmentSentinelReportOrDefault() {
  try {
    return await readJson(getAlignmentSentinelPath());
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return createDefaultAlignmentSentinelReport();
    }

    throw error;
  }
}

export async function saveAlignmentSentinelReport(report) {
  await writeJson(getAlignmentSentinelPath(), report);
  return report;
}

function getLatestDecisionBySkill(decisions = []) {
  const latestBySkill = new Map();
  for (const decision of decisions) {
    if (!decision?.skill) {
      continue;
    }

    latestBySkill.set(decision.skill, decision);
  }
  return latestBySkill;
}

export function evaluateAlignmentDrift({ releaseState, decisionLog }) {
  const latestDecisions = getLatestDecisionBySkill(decisionLog?.decisions ?? []);
  const findings = [];

  for (const rule of driftRuleDefinitions) {
    const latestDecision = latestDecisions.get(rule.skill);
    if (!latestDecision || latestDecision.status !== rule.expectedDecisionStatus) {
      continue;
    }

    const actualReleaseValue = releaseState?.[rule.releaseField];
    if (rule.allowedReleaseValues.includes(actualReleaseValue)) {
      continue;
    }

    findings.push({
      severity: "blocking",
      findingCode: rule.findingCode,
      skill: rule.skill,
      expectedDecisionStatus: rule.expectedDecisionStatus,
      releaseField: rule.releaseField,
      expectedReleaseValues: rule.allowedReleaseValues,
      actualReleaseValue,
      decisionTimestamp: latestDecision.timestamp ?? null,
      decisionSummary: latestDecision.decision ?? null,
    });
  }

  return {
    driftStatus: findings.length > 0 ? "DRIFTED" : "CLEAR",
    rebootPlanned: findings.length > 0,
    rebootReason:
      findings.length > 0
        ? "Release state drifted from the latest approved lane-owned decisions."
        : null,
    resumeTrigger: "$maestro",
    findings,
  };
}

export function createAlignmentRecoveryPlan(report) {
  const findings = report?.findings ?? [];
  return {
    record_type: "alignment_recovery_plan",
    driftStatus: report?.driftStatus ?? (findings.length > 0 ? "DRIFTED" : "CLEAR"),
    rebootPlanned: findings.length > 0,
    resumeTrigger: report?.resumeTrigger ?? "$maestro",
    requiredActions: findings.map((finding) => ({
      skill: finding.skill,
      repairField: finding.releaseField,
      expectedValues: finding.expectedReleaseValues,
      actualValue: finding.actualReleaseValue,
      action:
        "Rehydrate from baseline runtime artifacts, then rerun the owning lane or restore lane-owned release state before worker dispatch resumes.",
    })),
    mayDispatchWorkers: findings.length === 0,
    mayMutateReleaseStateDirectly: false,
  };
}
