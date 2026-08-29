import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { stdin as input, stdout as output } from "node:process";
import readline from "node:readline/promises";
import { agentRegistry, listAgents } from "./agents.js";
import {
  createSkillCompatibilityPayload,
  writeSkillCompatibilityExport,
} from "./runtime/skills-registry-export.js";
import { ensureSkillsInstalled, ensureSupportBundleInstalled } from "./skill-installer.js";

const selectionFile = ".ma/prelaunch.json";
const projectSignals = {
  cursor: [".cursor"],
  windsurf: [".windsurf"],
  cline: [".cline"],
  continue: [".continue"],
  roo: [".roo"],
  "kiro-cli": [".kiro"],
  junie: [".junie"],
};
const globalSignals = {
  cursor: ["~/.cursor"],
  windsurf: ["~/.codeium/windsurf"],
  cline: ["~/.cline"],
  continue: ["~/.continue"],
  roo: ["~/.roo"],
  "kiro-cli": ["~/.kiro"],
  junie: ["~/.junie"],
};

function expandHome(value) {
  return value.startsWith("~/") ? path.join(os.homedir(), value.slice(2)) : value;
}

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function detectPrelaunchTargets(cwd = process.cwd()) {
  const targets = listAgents().map((agent) => {
    const definition = agentRegistry[agent.id];
    const projectPath = definition?.universal
      ? path.join(cwd, ".agents")
      : path.join(cwd, agent.skillsDir);
    const globalPath = expandHome(agent.globalSkillsDir);
    return {
      id: agent.id,
      displayName: agent.displayName,
      surface: agent.surface,
      project: projectPath,
      global: globalPath,
      projectSignals: (projectSignals[agent.id] ?? []).map((signal) => path.join(cwd, signal)),
      globalSignals: (globalSignals[agent.id] ?? []).map(expandHome),
      projectDetected: Boolean(definition?.universal) || false,
      globalDetected: false,
    };
  });

  for (const target of targets) {
    target.projectDetected =
      (await exists(target.project)) ||
      (await Promise.all(target.projectSignals.map(exists))).some(Boolean);
    target.globalDetected = await exists(target.global);
    delete target.projectSignals;
    target.globalDetected ||= (await Promise.all(target.globalSignals.map(exists))).some(Boolean);
    delete target.globalSignals;
  }
  return targets;
}

async function readSelection(cwd) {
  try {
    const value = JSON.parse(await fs.readFile(path.join(cwd, selectionFile), "utf8"));
    if (
      (value.scope === "project" || value.scope === "global") &&
      Array.isArray(value.targets) &&
      value.targets.every((target) => typeof target === "string" && agentRegistry[target])
    ) {
      return value;
    }
  } catch {
    return null;
  }
  return null;
}

export async function choosePrelaunchInstall({
  cwd = process.cwd(),
  interactive = Boolean(input.isTTY && output.isTTY),
} = {}) {
  if (!interactive || process.env.MA_SKIP_PRELAUNCH === "1") return null;
  const previous = await readSelection(cwd);
  if (previous) return previous;

  const detected = await detectPrelaunchTargets(cwd);
  const detectedIds = detected
    .filter((target) => target.projectDetected || target.globalDetected)
    .map((target) => target.id);
  const suggested = detectedIds.length > 0 ? detectedIds : ["codex"];
  console.log("Meta-Architect pre-launch setup");
  console.log("Detected targets:");
  for (const target of detected) {
    if (target.projectDetected || target.globalDetected) {
      console.log(`- ${target.id}: ${target.projectDetected ? "project" : "user"}`);
    }
  }
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(
      `Install scope and targets [project:${suggested.join(",")}]: `,
    );
    const value = answer.trim() || `project:${suggested.join(",")}`;
    const [scope, targetValue] = value.split(":", 2);
    const targets = (targetValue || "codex")
      .split(",")
      .map((target) => target.trim())
      .filter((target, index, values) => agentRegistry[target] && values.indexOf(target) === index);
    if (!(scope === "project" || scope === "global") || targets.length === 0) {
      throw new Error("Use project:codex,cursor or global:codex,cursor");
    }
    return { schemaVersion: "0.1.0", scope, targets };
  } finally {
    rl.close();
  }
}

export async function installPrelaunchSelection(selection, cwd = process.cwd()) {
  if (
    !selection ||
    !["project", "global"].includes(selection.scope) ||
    !Array.isArray(selection.targets) ||
    selection.targets.length === 0 ||
    selection.targets.some((target) => typeof target !== "string" || !agentRegistry[target])
  ) {
    throw new Error("Invalid pre-launch selection");
  }
  const payload = createSkillCompatibilityPayload({
    name: "meta-architect",
    description: "Meta-Architect host compatibility entrypoint.",
    capabilities: ["maestro", "agent-compatibility"],
  });
  const results = [];
  if (selection.targets.includes("codex")) {
    const skillsRoot =
      selection.scope === "global" ? undefined : path.join(cwd, ".agents", "skills");
    const supportRoot =
      selection.scope === "global" ? undefined : path.join(cwd, ".ma", "support-bundle");
    results.push(
      await ensureSkillsInstalled({ targetRoot: skillsRoot }),
      await ensureSupportBundleInstalled({ targetRoot: supportRoot }),
    );
  }
  for (const target of selection.targets) {
    if (selection.scope === "global" && target === "codex") continue;
    results.push(
      await writeSkillCompatibilityExport({
        payload,
        agentType: target,
        cwd,
        global: selection.scope === "global",
        agentRootExists: true,
      }),
    );
  }
  await fs.mkdir(path.join(cwd, ".ma"), { recursive: true });
  await fs.writeFile(path.join(cwd, selectionFile), `${JSON.stringify(selection, null, 2)}\n`, {
    mode: 0o600,
  });
  return { selection, results };
}
