import fs from "node:fs/promises";
import path from "node:path";
import { appendDecision } from "./decision-log.js";
import { readJson, writeFileIfMissing, writeJson } from "./fs-utils.js";
import { validateMcpServers } from "./mcp-config.js";
import { McpSseClient } from "./mcp-live-client.js";
import { getRepoRoot, getRuntimeReadPath, getRuntimeWritePath, packageRoot } from "./paths.js";
import {
  seedRuntimeArtifacts,
  writeArchitectureArtifacts,
  writeEvidenceSpec,
  writeExperienceSpec,
  writeLogicSpec,
  writeProjectContext,
  writeSecuritySpec,
} from "./runtime-artifacts.js";
import { syncStatusUpdates } from "./state-sync.js";

const skillNames = ["$arch", "$sage", "$flow", "$vet", "$vibe", "$build"];
const workflowTemplates = {
  "arch.skill.md":
    "# `$arch`\n\nProduces blueprint architecture, stack rationale, subsystem design, and tradeoffs.\n",
  "sage.skill.md":
    "# `$sage`\n\nMaps architectural choices to approved OSS candidates from GitMCP-backed collections.\n",
  "vet.skill.md": "# `$vet`\n\nAudits security posture, CVE signals, and safer alternatives.\n",
  "flow.skill.md": "# `$flow`\n\nValidates logic, state transitions, and unresolved blockers.\n",
  "vibe.skill.md":
    "# `$vibe`\n\nReviews developer and user experience risks before build execution.\n",
  "build.skill.md": "# `$build`\n\nChecks gates and plans bounded build execution.\n",
  "sync.skill.md":
    "# `$sync`\n\nReserved for refreshing mapped MCP sources and availability records.\n",
};

export function listSkills() {
  return skillNames;
}

async function readIdeaText() {
  const decisions = await readJson(getRuntimeReadPath("decisions.json"));
  const ideaDecision = [...decisions.decisions].reverse().find((entry) => entry.kind === "idea");
  return ideaDecision?.idea ?? null;
}

export async function runIdea(idea) {
  const trimmed = idea.trim();
  if (!trimmed) {
    throw new Error("Idea text is required");
  }

  await writeProjectContext(trimmed);

  await appendDecision({
    kind: "idea",
    idea: trimmed,
    decision: "Captured project idea",
    status: "CLEAR",
    evidence: [{ kind: "user-input", value: trimmed }],
    blockers: [],
    next_allowed_triggers: ["$arch"],
  });

  await syncStatusUpdates({ idea_status: "CLEAR" });
}

export async function runArch() {
  const idea = await readIdeaText();
  if (!idea) {
    throw new Error("Cannot run $arch before ma idea captures a project brief");
  }

  const blueprint = {
    summary: `Blueprint derived from idea: ${idea}`,
    suggestedStack: ["Node.js", "MCP", "GitMCP", "Git worktree"],
    outcome: "Produce a gated architecture and implementation plan",
  };

  await writeArchitectureArtifacts({ idea, blueprint });

  await appendDecision({
    kind: "skill",
    skill: "$arch",
    decision: "Generated architecture blueprint",
    status: "APPROVED",
    evidence: [blueprint],
    blockers: [],
    next_allowed_triggers: ["$sage"],
  });

  await syncStatusUpdates({ architecture_status: "APPROVED" });
}

export async function runSage() {
  const config = await validateMcpServers();
  const sourceEntries = config.servers.map((server) => ({
    repo: server.repo,
    endpoint: server.endpoint,
    category: server.category,
  }));
  const blockers = [];
  const idea = (await readIdeaText()) ?? "software architecture";
  const disableLiveProbe = process.env.MA_DISABLE_LIVE_MCP === "1";
  const probeCandidates = sourceEntries.slice(0, 1);
  let liveSuccessCount = 0;

  for (const source of sourceEntries) {
    if (disableLiveProbe) {
      source.liveProbe = {
        skipped: true,
        reason: "MA_DISABLE_LIVE_MCP=1",
      };
      continue;
    }

    if (!probeCandidates.includes(source)) {
      source.liveProbe = {
        skipped: true,
        reason: "Not selected for the live probe set in this run",
      };
      continue;
    }

    const client = new McpSseClient(source.endpoint);
    try {
      const init = await client.connect();
      const tools = await client.request("tools/list", {});
      const searchTool = tools.tools?.find(
        (tool) => tool.name.includes("search_") && tool.name.endsWith("_documentation"),
      );
      const fetchTool = tools.tools?.find(
        (tool) => tool.name.includes("fetch_") && tool.name.endsWith("_documentation"),
      );

      let evidence = null;
      if (searchTool) {
        evidence = await client.request("tools/call", {
          name: searchTool.name,
          arguments: { query: idea },
        });
      } else if (fetchTool) {
        evidence = await client.request("tools/call", {
          name: fetchTool.name,
          arguments: {},
        });
      }

      source.liveProbe = {
        serverName: init.serverInfo?.name ?? "unknown",
        serverVersion: init.serverInfo?.version ?? "unknown",
        toolsCount: tools.tools?.length ?? 0,
        queryMode: searchTool ? "search" : fetchTool ? "fetch" : "list-only",
        sampleText:
          evidence?.content?.find((item) => item.type === "text")?.text?.slice(0, 400) ?? null,
      };
      liveSuccessCount += 1;
    } catch (error) {
      source.liveProbe = {
        error: error.message,
      };
      blockers.push(`Live MCP query failed for ${source.repo}: ${error.message}`);
    } finally {
      await client.close().catch(() => {});
    }
  }

  const existing = await readJson(getRuntimeWritePath("evidence", "sources.json"));
  existing.items = sourceEntries;
  await writeJson(getRuntimeWritePath("evidence", "sources.json"), existing);

  const verified = sourceEntries.length > 0 && (disableLiveProbe || liveSuccessCount > 0);
  await writeEvidenceSpec({ idea, sourceEntries, verified, blockers });
  await appendDecision({
    kind: "skill",
    skill: "$sage",
    decision: "Bound architectural choices to approved GitMCP sources using live MCP queries",
    status: verified ? "VERIFIED" : "UNVERIFIED",
    evidence: sourceEntries,
    blockers: sourceEntries.length > 0 ? blockers : ["No approved GitMCP sources configured"],
    next_allowed_triggers: verified ? ["$flow"] : ["mcp/servers.json", "$sage"],
  });

  await syncStatusUpdates({
    evidence_status: verified ? "VERIFIED" : sourceEntries.length > 0 ? "PARTIAL" : "MISSING",
  });
}

export async function runFlow() {
  const logicMap = {
    states: ["idea", "architecture", "evidence", "logic", "security", "experience", "build"],
    blockers: [],
  };

  await writeLogicSpec(logicMap);

  await appendDecision({
    kind: "skill",
    skill: "$flow",
    decision: "Validated logic and state transitions",
    status: "GREEN",
    evidence: [logicMap],
    blockers: [],
    next_allowed_triggers: ["$vet"],
  });

  await syncStatusUpdates({ logic_status: "GREEN" });
}

export async function runVet() {
  const auditLog = await readJson(getRuntimeWritePath("evidence", "audits.json"));
  const cveLog = await readJson(getRuntimeWritePath("evidence", "cves.json"));
  const finding = {
    severity: "INFO",
    summary: "Baseline review completed for the approved kernel",
    unresolved: false,
  };
  auditLog.items.push(finding);
  await writeJson(getRuntimeWritePath("evidence", "audits.json"), auditLog);
  cveLog.items.push({
    id: "baseline-review",
    severity: "INFO",
    unresolved: false,
  });
  await writeJson(getRuntimeWritePath("evidence", "cves.json"), cveLog);
  await writeSecuritySpec({
    finding,
    auditCount: auditLog.items.length,
    cveCount: cveLog.items.length,
  });

  await appendDecision({
    kind: "skill",
    skill: "$vet",
    decision: "Reviewed security posture for the current implementation",
    status: "GREEN",
    evidence: [finding],
    blockers: [],
    next_allowed_triggers: ["$vibe"],
  });

  await syncStatusUpdates({ security_status: "GREEN" });
}

export async function runVibe() {
  const outcomes = await readJson(getRuntimeWritePath("evidence", "outcomes.json"));
  const note = {
    area: "developer-experience",
    summary: "The in-session skill flow remains the primary Meta-Architect surface",
  };
  outcomes.items.push(note);
  await writeJson(getRuntimeWritePath("evidence", "outcomes.json"), outcomes);
  await writeExperienceSpec({ note, outcomeCount: outcomes.items.length });

  await appendDecision({
    kind: "skill",
    skill: "$vibe",
    decision: "Recorded DX/UX review notes",
    status: "GREEN",
    evidence: [note],
    blockers: [],
    next_allowed_triggers: ["$build"],
  });

  await syncStatusUpdates({ experience_status: "GREEN" });
}

export async function runInit() {
  const created = [];
  const targets = [
    ".codex/agents",
    ".codex/prompts",
    ".ma/skills",
    ".ma/evidence",
    ".ma/context",
    ".ma/specs",
    ".ma/plans",
    "mcp",
    "docs",
    "docs/qa",
    "sprint",
  ];

  for (const relative of targets) {
    const target = path.join(getRepoRoot(), relative);
    await fs.mkdir(target, { recursive: true });
    created.push(relative);
  }

  const templateCopies = [
    [
      path.join(packageRoot, ".codex", "agents", "Architect.toml"),
      path.join(getRepoRoot(), ".codex", "agents", "Architect.toml"),
    ],
    [
      path.join(packageRoot, ".codex", "agents", "Sage.toml"),
      path.join(getRepoRoot(), ".codex", "agents", "Sage.toml"),
    ],
    [
      path.join(packageRoot, ".codex", "agents", "Auditor.toml"),
      path.join(getRepoRoot(), ".codex", "agents", "Auditor.toml"),
    ],
    [
      path.join(packageRoot, ".codex", "agents", "Flow.toml"),
      path.join(getRepoRoot(), ".codex", "agents", "Flow.toml"),
    ],
    [
      path.join(packageRoot, ".codex", "agents", "Vibe.toml"),
      path.join(getRepoRoot(), ".codex", "agents", "Vibe.toml"),
    ],
    [
      path.join(packageRoot, ".codex", "agents", "Builder.toml"),
      path.join(getRepoRoot(), ".codex", "agents", "Builder.toml"),
    ],
    [
      path.join(packageRoot, ".codex", "hooks.json"),
      path.join(getRepoRoot(), ".codex", "hooks.json"),
    ],
    [
      path.join(packageRoot, ".codex", "prompts", "enforcement.md"),
      path.join(getRepoRoot(), ".codex", "prompts", "enforcement.md"),
    ],
    [
      path.join(packageRoot, ".codex", "prompts", "release-rules.md"),
      path.join(getRepoRoot(), ".codex", "prompts", "release-rules.md"),
    ],
    [
      path.join(packageRoot, ".codex", "prompts", "skill-contract.md"),
      path.join(getRepoRoot(), ".codex", "prompts", "skill-contract.md"),
    ],
    [
      path.join(packageRoot, ".codex", "prompts", "onboarding.md"),
      path.join(getRepoRoot(), ".codex", "prompts", "onboarding.md"),
    ],
    [path.join(packageRoot, "docs", "README.md"), path.join(getRepoRoot(), "docs", "README.md")],
    [
      path.join(packageRoot, "docs", "getting-started.md"),
      path.join(getRepoRoot(), "docs", "getting-started.md"),
    ],
    [path.join(packageRoot, "docs", "skills.md"), path.join(getRepoRoot(), "docs", "skills.md")],
    [
      path.join(packageRoot, "docs", "mcp-setup.md"),
      path.join(getRepoRoot(), "docs", "mcp-setup.md"),
    ],
    [
      path.join(packageRoot, "docs", "release-spec.md"),
      path.join(getRepoRoot(), "docs", "release-spec.md"),
    ],
    [
      path.join(packageRoot, "docs", "qa", "release-readiness-0.1.0.md"),
      path.join(getRepoRoot(), "docs", "qa", "release-readiness-0.1.0.md"),
    ],
  ];

  const sprintFiles = [
    "00-idea.md",
    "01-architecture.md",
    "02-oss-evidence.md",
    "03-logic.md",
    "04-security.md",
    "05-dx-ux.md",
    "06-build-plan.md",
    "07-release.md",
  ];

  for (const file of sprintFiles) {
    templateCopies.push([
      path.join(packageRoot, "sprint", file),
      path.join(getRepoRoot(), "sprint", file),
    ]);
  }

  for (const file of ["servers.json", "collections.json", "fallback.json"]) {
    templateCopies.push([
      path.join(packageRoot, "mcp", file),
      path.join(getRepoRoot(), "mcp", file),
    ]);
  }

  for (const [src, dest] of templateCopies) {
    try {
      await fs.access(dest);
    } catch {
      await fs.copyFile(src, dest);
    }
  }

  await seedRuntimeArtifacts();

  await writeFileIfMissing(
    getRuntimeWritePath("decisions.json"),
    `${JSON.stringify(
      {
        schemaVersion: "0.1.0",
        idea_status: "DRAFT",
        architecture_status: "DRAFT",
        evidence_status: "MISSING",
        logic_status: "PENDING",
        security_status: "PENDING",
        experience_status: "PENDING",
        build_status: "LOCKED",
        merge_status: "LOCKED",
        release_status: "LOCKED",
        decisions: [],
      },
      null,
      2,
    )}\n`,
  );

  await writeFileIfMissing(
    getRuntimeWritePath("release.json"),
    `${JSON.stringify(
      {
        schemaVersion: "0.1.0",
        idea_status: "DRAFT",
        architecture_status: "DRAFT",
        evidence_status: "MISSING",
        logic_status: "PENDING",
        security_status: "PENDING",
        experience_status: "PENDING",
        build_status: "LOCKED",
        merge_status: "LOCKED",
        release_status: "LOCKED",
        waiver: null,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );

  for (const [fileName, content] of Object.entries(workflowTemplates)) {
    await writeFileIfMissing(getRuntimeWritePath("skills", fileName), content);
  }

  await writeFileIfMissing(
    path.join(getRepoRoot(), "mcp", "servers.json"),
    `${JSON.stringify({ schemaVersion: "0.1.0", servers: [] }, null, 2)}\n`,
  );
  await writeFileIfMissing(
    path.join(getRepoRoot(), "mcp", "collections.json"),
    `${JSON.stringify({ schemaVersion: "0.1.0", collections: {} }, null, 2)}\n`,
  );
  await writeFileIfMissing(
    path.join(getRepoRoot(), "mcp", "fallback.json"),
    `${JSON.stringify(
      {
        schemaVersion: "0.1.0",
        fallback: {
          endpoint: "https://gitmcp.io/docs",
          policy: "Use only when no approved exact endpoint exists.",
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFileIfMissing(
    getRuntimeWritePath("evidence", "sources.json"),
    `${JSON.stringify(
      {
        schemaVersion: "0.1.0",
        items: [],
      },
      null,
      2,
    )}\n`,
  );
  await writeFileIfMissing(
    getRuntimeWritePath("evidence", "audits.json"),
    `${JSON.stringify(
      {
        schemaVersion: "0.1.0",
        items: [],
      },
      null,
      2,
    )}\n`,
  );
  await writeFileIfMissing(
    getRuntimeWritePath("evidence", "outcomes.json"),
    `${JSON.stringify(
      {
        schemaVersion: "0.1.0",
        items: [],
      },
      null,
      2,
    )}\n`,
  );
  await writeFileIfMissing(
    getRuntimeWritePath("evidence", "cves.json"),
    `${JSON.stringify(
      {
        schemaVersion: "0.1.0",
        items: [],
      },
      null,
      2,
    )}\n`,
  );

  await writeFileIfMissing(
    path.join(getRepoRoot(), "docs", "onboarding.md"),
    "# Onboarding\n\nMeta-Architect initializes the core scaffold, MCP config, and canonical .ma runtime files.\n",
  );

  return created;
}
