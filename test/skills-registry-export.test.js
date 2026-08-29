import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import {
  createDefaultSkillsRegistryExport,
  createHostInstallReceipt,
  createSkillCompatibilityPayload,
  createSkillLockEntry,
  inspectSkillCompatibilityInstall,
  isUniversalAgent,
  renderSkillCompatibilitySkillMd,
  resolveSkillInstallPlan,
  sanitizeSkillName,
  validateSkillLockEntry,
  validateSkillsRegistryExport,
  verifyCrossAgentInstallMatrix,
  writeSkillCompatibilityExport,
} from "../src/runtime/skills-registry-export.js";
import { createTestNamespace } from "../src/test-fixtures.js";

test("skills registry export defines MA authority boundaries", () => {
  const registry = validateSkillsRegistryExport(createDefaultSkillsRegistryExport());

  assert.equal(registry.canonical_dir, ".agents/skills");
  assert.equal(registry.target_count, 55);
  assert.equal(
    Object.values(registry.targets).every((target) => target.support === "native"),
    true,
  );
  assert.equal(
    Object.values(registry.targets).every((target) => target.native_artifacts.length > 0),
    true,
  );
  assert.equal(registry.universal_targets.includes("codex"), true);
  assert.equal(registry.non_universal_targets.includes("claude-code"), true);
  assert.equal(registry.authority_boundary.exported_payloads_may_mutate_release_state, false);
  assert.equal(registry.authority_boundary.exported_payloads_are_managed_workers, false);
});

test("skill install planning handles universal and non-universal target paths", () => {
  assert.equal(isUniversalAgent("codex"), true);
  assert.equal(isUniversalAgent("claude-code"), false);
  assert.equal(sanitizeSkillName("../Meta Architect!"), "meta-architect");

  const codexPlan = resolveSkillInstallPlan({
    skillName: "Meta Architect",
    agentType: "codex",
    cwd: "/repo",
  });
  assert.equal(codexPlan.action, "canonical-only");
  assert.equal(codexPlan.targetDir, "/repo/.agents/skills/meta-architect");

  const missingClaudePlan = resolveSkillInstallPlan({
    skillName: "Meta Architect",
    agentType: "claude-code",
    cwd: "/repo",
    agentRootExists: false,
  });
  assert.equal(missingClaudePlan.action, "skip-missing-agent-root");
  assert.equal(missingClaudePlan.skipped, true);

  const claudePlan = resolveSkillInstallPlan({
    skillName: "Meta Architect",
    agentType: "claude-code",
    cwd: "/repo",
    agentRootExists: true,
  });
  assert.equal(claudePlan.action, "symlink");
  assert.equal(claudePlan.canonicalDir, "/repo/.agents/skills/meta-architect");
  assert.equal(claudePlan.targetDir, "/repo/.claude/skills/meta-architect");

  const copyPlan = resolveSkillInstallPlan({
    skillName: "Meta Architect",
    agentType: "aider-desk",
    cwd: "/repo",
    mode: "copy",
  });
  assert.equal(copyPlan.action, "copy");
  assert.equal(copyPlan.targetDir, "/repo/.aider-desk/skills/meta-architect");
});

test("skills registry renders MA-owned compatibility payloads and install receipts", () => {
  const payload = createSkillCompatibilityPayload({
    name: "Meta Architect",
    description: "Route host agents into Meta-Architect core.",
    capabilities: ["obsidian_integration_core", "context_economy_core"],
  });
  const skillMd = renderSkillCompatibilitySkillMd(payload);
  const installPlan = resolveSkillInstallPlan({
    skillName: payload.name,
    agentType: "codex",
    cwd: "/repo",
  });
  const receipt = createHostInstallReceipt({ payload, installPlan });

  assert.equal(payload.name, "meta-architect");
  assert.equal(payload.authority_boundary.may_mutate_release_state, false);
  assert.match(skillMd, /Route execution through `\$maestro` or the owning MA lane/);
  assert.match(skillMd, /Start the umbrella lane with `\$maestro`/);
  assert.match(skillMd, /vault_context/);
  assert.equal(receipt.record_type, "host_install_receipt");
  assert.equal(receipt.records_as, "host_compatibility_payload");
  assert.equal(receipt.production_evidence, false);
  assert.equal(receipt.targetDir, "/repo/.agents/skills/meta-architect");

  const lockEntry = validateSkillLockEntry(
    createSkillLockEntry({
      payload,
      source: "JustineDevs/meta-architect",
      sourceType: "github",
      sourceUrl: "https://github.com/JustineDevs/meta-architect",
      ref: "main",
      skillPath: "skills/meta-architect",
      selectedAgentTargets: ["codex", "claude-code"],
    }),
  );
  assert.equal(lockEntry.record_type, "skill_lock_entry");
  assert.equal(lockEntry.sourceType, "github");
  assert.equal(lockEntry.selectedAgentTargets.includes("claude-code"), true);
  assert.equal(lockEntry.authority_boundary.may_mutate_release_state, false);
  assert.equal(typeof lockEntry.skillFolderHash, "string");
});

test("skills registry renders host-native invocation aliases", () => {
  const payload = createSkillCompatibilityPayload({ name: "Meta Architect" });
  assert.match(
    renderSkillCompatibilitySkillMd(payload, { agentType: "cursor" }),
    /Start the umbrella lane with `\/meta-architect`/,
  );
  assert.match(
    renderSkillCompatibilitySkillMd(payload, { agentType: "pi" }),
    /Start the umbrella lane with `meta-architect`/,
  );
});

test("skills registry writes canonical compatibility export files", async (t) => {
  const tempRoot = createTestNamespace("ma-skills-export");
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });
  const payload = createSkillCompatibilityPayload({
    name: "Meta Architect",
    description: "Route host agents into Meta-Architect core.",
    capabilities: ["active_autonomy_core"],
  });

  const result = await writeSkillCompatibilityExport({
    payload,
    agentType: "codex",
    cwd: tempRoot,
  });
  const skillMd = await fs.readFile(`${tempRoot}/.agents/skills/meta-architect/SKILL.md`, "utf8");
  const receipt = JSON.parse(
    await fs.readFile(`${tempRoot}/.agents/skills/meta-architect/ma-install-receipt.json`, "utf8"),
  );
  const lockEntry = JSON.parse(
    await fs.readFile(`${tempRoot}/.agents/skills/meta-architect/ma-skill-lock.json`, "utf8"),
  );

  assert.equal(result.installPlan.action, "canonical-only");
  assert.equal(result.fanoutMode, "canonical-only");
  assert.match(skillMd, /active_autonomy_core/);
  assert.equal(receipt.record_type, "host_install_receipt");
  assert.equal(receipt.production_evidence, false);
  assert.equal(lockEntry.record_type, "skill_lock_entry");
  assert.deepEqual(lockEntry.selectedAgentTargets, ["codex"]);
  assert.equal(
    result.written.some((writtenPath) => writtenPath.endsWith("ma-skill-lock.json")),
    true,
  );
});

test("skills registry fans out to non-universal host roots and supports copy mode", async (t) => {
  const tempRoot = createTestNamespace("ma-skills-fanout");
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });
  await fs.mkdir(`${tempRoot}/.claude`, { recursive: true });
  const payload = createSkillCompatibilityPayload({
    name: "Meta Architect",
    description: "Route host agents into Meta-Architect core.",
    capabilities: ["context_economy_core"],
  });

  const symlinkResult = await writeSkillCompatibilityExport({
    payload,
    agentType: "claude-code",
    cwd: tempRoot,
    agentRootExists: true,
  });
  const targetStat = await fs.lstat(`${tempRoot}/.claude/skills/meta-architect`);
  assert.equal(symlinkResult.installPlan.action, "symlink");
  assert.equal(["symlink", "copy-fallback"].includes(symlinkResult.fanoutMode), true);
  assert.equal(targetStat.isSymbolicLink() || targetStat.isDirectory(), true);

  const copyResult = await writeSkillCompatibilityExport({
    payload,
    agentType: "aider-desk",
    cwd: tempRoot,
    mode: "copy",
  });
  const copiedSkill = await fs.readFile(
    `${tempRoot}/.aider-desk/skills/meta-architect/SKILL.md`,
    "utf8",
  );
  assert.equal(copyResult.installPlan.action, "copy");
  assert.equal(copyResult.fanoutMode, "copy");
  assert.match(copiedSkill, /context_economy_core/);
});

test("skills registry verifies symlink, copy fallback, and skipped missing-root fanout", async (t) => {
  const tempRoot = createTestNamespace("ma-skills-verify");
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });
  await fs.mkdir(`${tempRoot}/.claude`, { recursive: true });
  const payload = createSkillCompatibilityPayload({
    name: "Meta Architect",
    description: "Route host agents into Meta-Architect core.",
    capabilities: ["active_autonomy_core", "obsidian_integration_core"],
  });

  const symlinkResult = await writeSkillCompatibilityExport({
    payload,
    agentType: "claude-code",
    cwd: tempRoot,
  });
  const symlinkVerification = await inspectSkillCompatibilityInstall({
    result: symlinkResult,
    payload,
  });
  assert.equal(symlinkVerification.ok, true);
  assert.equal(symlinkVerification.targetKind, "symlink");

  const fallbackResult = await writeSkillCompatibilityExport({
    payload,
    agentType: "claude-code",
    cwd: tempRoot,
    createSymlink: async () => {
      throw new Error("force fallback");
    },
  });
  const fallbackVerification = await inspectSkillCompatibilityInstall({
    result: fallbackResult,
    payload,
  });
  assert.equal(fallbackResult.fanoutMode, "copy-fallback");
  assert.equal(fallbackVerification.ok, true);
  assert.equal(fallbackVerification.targetKind, "directory-copy");

  const skippedResult = await writeSkillCompatibilityExport({
    payload,
    agentType: "windsurf",
    cwd: tempRoot,
  });
  const skippedVerification = await inspectSkillCompatibilityInstall({
    result: skippedResult,
    payload,
  });
  assert.equal(skippedResult.installPlan.action, "skip-missing-agent-root");
  assert.equal(skippedVerification.ok, true);
  assert.equal(skippedVerification.targetKind, "skipped");
});

test("cross-agent install verification covers supported v1 matrix behaviors", async (t) => {
  const tempRoot = createTestNamespace("ma-cross-agent-install");
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });
  const payload = createSkillCompatibilityPayload({
    name: "Meta Architect",
    description: "Route host agents into Meta-Architect core.",
    capabilities: ["context_economy_core", "active_autonomy_core"],
  });

  const report = await verifyCrossAgentInstallMatrix({
    payload,
    cwd: tempRoot,
    targets: ["codex", "claude-code", "windsurf", "aider-desk"],
    existingAgentRoots: ["claude-code", "aider-desk"],
    copyFallbackTargets: ["aider-desk"],
  });
  const canonicalOnly = report.results.find((result) => result.action === "canonical-only");
  const symlink = report.results.find((result) => result.fanoutMode === "symlink");
  const fallback = report.results.find((result) => result.fanoutMode === "copy-fallback");
  const skipped = report.results.find((result) => result.action === "skip-missing-agent-root");

  assert.equal(report.record_type, "cross_agent_install_verification");
  assert.equal(report.ok, true);
  assert.equal(report.production_evidence, false);
  assert.equal(canonicalOnly.targetKind, "canonical");
  assert.equal(symlink.targetKind, "symlink");
  assert.equal(fallback.targetKind, "directory-copy");
  assert.equal(skipped.targetKind, "skipped");
});
