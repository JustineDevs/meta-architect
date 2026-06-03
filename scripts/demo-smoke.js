#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createContextEconomyView,
  createDefaultLearningLoopCore,
  createDefaultPromptStrategyCore,
  createDiscoveredEnvironmentAwarenessCore,
  createObsidianNote,
  createRalphPrdContract,
  evaluateLearningLoopReadiness,
  indexObsidianVault,
  readObsidianNote,
  runIdea,
  runInit,
  updateObsidianNote,
  validatePromptStrategyCore,
  validateRalphPrdContract,
  writeObsidianVaultIndex,
} from "../index.js";
import { loadRuntimeSnapshot } from "../src/runtime/runtime-state.js";
import { runMaestro } from "../src/skills.js";

const demoIdea =
  "Northstar Logistics wants to harden an existing dispatch analytics workspace for a production release. MA must inspect current runtime context, use Obsidian vault notes as brain context, route through relevant roles, preserve security gates, and produce a release-safe next action instead of asking for permission.";

async function writeFile(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, "utf8");
}

async function seedWorkspace(root) {
  await writeFile(
    path.join(root, "package.json"),
    `${JSON.stringify(
      {
        name: "northstar-dispatch-analytics",
        version: "2.4.0",
        type: "module",
        scripts: {
          test: "node --test",
          check: "node --check src/index.js",
          release: "node scripts/release-check.js",
        },
        dependencies: {
          "@modelcontextprotocol/sdk": "^1.0.0",
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    path.join(root, "src", "index.js"),
    "export const serviceName = 'northstar-dispatch-analytics';\n",
  );
  await writeFile(
    path.join(root, "mcp", "servers.json"),
    `${JSON.stringify(
      {
        mcpServers: {
          "obsidian-api Docs": {
            url: "https://gitmcp.io/obsidianmd/obsidian-api",
          },
        },
      },
      null,
      2,
    )}\n`,
  );
}

async function seedVault(vaultPath) {
  await writeFile(
    path.join(vaultPath, "Northstar", "Dispatch Release Objective.md"),
    `---
ma_records_as: vault_context
ma_project: northstar-dispatch-analytics
ma_capabilities:
  - maestro
  - obsidian
  - learning-loop
ma_source_workspace: northstar-dispatch-analytics
---
# Dispatch Release Objective

Northstar Logistics needs a production-safe release plan for dispatch analytics.

## Pain Points

- Missed gate ownership causes late release rollback risk. #release
- Unstructured knowledge lives in operations notes and is not visible to build planning. #knowledge
- Security and DX review happen after implementation instead of before build execution. #security #dx

## Links

- [[Northstar/Risk Register]]
- [[Meta-Architect/Core Brain Context]]
`,
  );
  await writeFile(
    path.join(vaultPath, "Northstar", "Risk Register.md"),
    `---
ma_records_as: vault_context
ma_project: northstar-dispatch-analytics
---
# Risk Register

Known risks:

- Third-party carrier API failures can block dispatch reconciliation.
- Customer PII must not be copied into prompt-bound release artifacts.
- [[Northstar/Dispatch Release Objective]] owns the business target.
`,
  );
  await writeFile(
    path.join(vaultPath, "Meta-Architect", "Core Brain Context.md"),
    `---
ma_records_as: vault_context
ma_project: northstar-dispatch-analytics
---
# Core Brain Context

MA should treat this vault as semantic brain context only.
Authoritative build evidence must return through $maestro or the owning lane.
`,
  );
}

function assertNoDemoBranding(value) {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(serialized, /Demo Account|Test Company|Sample Co|Acme/i);
}

async function main() {
  const originalCwd = process.cwd();
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "ma-real-demo-"));
  const vaultPath = path.join(workspace, "Northstar Vault");
  await seedWorkspace(workspace);
  await seedVault(vaultPath);

  process.chdir(workspace);
  try {
    await runInit();
    await runIdea(demoIdea);
    await runMaestro();

    const createdNote = await createObsidianNote({
      vaultPath,
      notePath: "Meta-Architect/Release Gate Plan.md",
      overwrite: true,
      content: `---
ma_records_as: vault_context
ma_project: northstar-dispatch-analytics
ma_source_workspace: northstar-dispatch-analytics
---
# Release Gate Plan

This note records the MA demo path for Northstar Logistics.

- Start at [[Meta-Architect/Map of Content]]
- Use [[Northstar/Dispatch Release Objective]] for buyer context
- Keep build evidence in MA lane artifacts
`,
    });
    await updateObsidianNote({
      vaultPath,
      notePath: "Meta-Architect/Release Gate Plan.md",
      content: `${createdNote.relative_path ? "" : ""}---
ma_records_as: vault_context
ma_project: northstar-dispatch-analytics
ma_source_workspace: northstar-dispatch-analytics
---
# Release Gate Plan

This note records the MA demo path for Northstar Logistics.

- Start at [[Meta-Architect/Map of Content]]
- Use [[Northstar/Dispatch Release Objective]] for buyer context
- Use [[Northstar/Risk Register]] for security and rollback concerns
- Keep build evidence in MA lane artifacts
`,
    });
    const readNote = await readObsidianNote({
      vaultPath,
      notePath: "Meta-Architect/Release Gate Plan.md",
    });
    const vaultIndex = await writeObsidianVaultIndex({ vaultPath });
    const directVaultIndex = await indexObsidianVault({ vaultPath });

    const learningReadiness = evaluateLearningLoopReadiness(createDefaultLearningLoopCore());
    const promptStrategy = validatePromptStrategyCore(createDefaultPromptStrategyCore());
    const contextEconomy = createContextEconomyView({
      text: "The architecture lane should preserve exact commands, risk language, and verification gaps while compressing low-value filler for the live demo operator.",
      level: "full",
    });
    const environmentAwareness = await createDiscoveredEnvironmentAwarenessCore({ cwd: workspace });
    const ralphContract = validateRalphPrdContract(
      createRalphPrdContract({
        project: "northstar-dispatch-analytics",
        branchName: "ralph/northstar-release-gates",
        description: "Prepare release-safe dispatch analytics execution handoff.",
        buildSlice: [
          "Verify MA release gates before Ralph-style execution begins.",
          "Preserve Obsidian context as vault_context, not build_evidence.",
        ],
        verificationPlan: [
          "$arch, $sage, $flow, $vet, and $vibe are represented before $build.",
          "Obsidian context is tagged as vault_context, not build_evidence.",
        ],
      }),
    );
    const runtimeSnapshot = await loadRuntimeSnapshot();

    const proof = {
      record_type: "ma_real_demo_smoke_proof",
      workspace,
      vaultPath,
      idea: demoIdea,
      maestro: {
        global_status: runtimeSnapshot.maestroState.global_status,
        track_count: Object.keys(runtimeSnapshot.maestroState.runtime_tracks).length,
        next_plan_exists: true,
      },
      obsidian: {
        note_count: vaultIndex.note_count,
        records_as: vaultIndex.records_as,
        build_evidence: vaultIndex.build_evidence,
        graph_map_present: vaultIndex.notes.some(
          (note) => note.relative_path === "Meta-Architect/Map of Content.md",
        ),
        linked_release_plan: readNote.content.includes("[[Meta-Architect/Map of Content]]"),
        direct_index_note_count: directVaultIndex.note_count,
      },
      learning: {
        domain_count: learningReadiness.domains,
        verified_domain_count: learningReadiness.verified_domains,
        ready: learningReadiness.ready,
      },
      prompt_strategy: {
        lane_count: Object.keys(promptStrategy.lane_policy).length,
      },
      context_economy: {
        mode: contextEconomy.mode,
        preserved_exact_count: contextEconomy.preserved_exact.length,
      },
      environment_awareness: {
        capability_count: environmentAwareness.capabilities.length,
        capability_types: [
          ...new Set(environmentAwareness.capabilities.map((item) => item.capability_type)),
        ].sort(),
      },
      ralph: {
        story_count: ralphContract.userStories.length,
        authority: ralphContract.authority,
      },
    };

    assert.equal(proof.obsidian.records_as, "vault_context");
    assert.equal(proof.obsidian.build_evidence, false);
    assert.equal(proof.obsidian.graph_map_present, true);
    assert.equal(proof.obsidian.linked_release_plan, true);
    assert.equal(proof.learning.ready, true);
    assert.equal(proof.ralph.story_count, 1);
    assertNoDemoBranding(proof);

    await writeFile(
      path.join(workspace, ".ma", "evidence", "real-demo-smoke-proof.json"),
      `${JSON.stringify(proof, null, 2)}\n`,
    );
    console.log(JSON.stringify(proof, null, 2));
  } finally {
    process.chdir(originalCwd);
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
