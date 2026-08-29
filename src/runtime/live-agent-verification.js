import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { agentRegistry as executableAgents, resolveAgentCommand } from "../agents.js";
import {
  agentRegistry,
  createSkillCompatibilityPayload,
  verifyCrossAgentInstallMatrix,
} from "./skills-registry-export.js";

const defaultTimeoutMs = 5000;

function runVersionProbe(command, timeoutMs, args = ["--version"]) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      finish({ ok: false, reason: "version probe timed out" });
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.once("error", (error) => finish({ ok: false, reason: error.message }));
    child.once("close", (code) =>
      finish({
        ok: code === 0,
        version: stdout.trim(),
        reason: code === 0 ? null : stderr.trim() || `exited with code ${code}`,
      }),
    );
  });
}

function normalizeProbeCommand(command) {
  return [".js", ".mjs", ".cjs"].includes(path.extname(command))
    ? { command: process.execPath, args: [command, "--version"] }
    : { command, args: ["--version"] };
}

export async function verifyLiveAgentMatrix({
  cwd = process.cwd(),
  targets = Object.keys(agentRegistry),
  timeoutMs = defaultTimeoutMs,
} = {}) {
  const root = path.resolve(cwd);
  const tempRoot = await fsTempDirectory();
  try {
    const payload = createSkillCompatibilityPayload({
      name: "live-agent-verification",
      capabilities: ["maestro", "agent-compatibility"],
    });
    const distribution = await verifyCrossAgentInstallMatrix({
      payload,
      cwd: tempRoot,
      targets,
      existingAgentRoots: targets,
    });
    const results = [];
    for (const [index, target] of targets.entries()) {
      const distributionResult = distribution.results[index];
      const command = executableAgents[target]?.probeable ? resolveAgentCommand(target) : null;
      if (!command) {
        results.push({
          target,
          status: distributionResult?.ok ? "distribution-only" : "blocked",
          version: null,
          command: null,
          distribution: distributionResult?.ok === true,
          reason: "No safe non-interactive host command is registered for this target.",
        });
        continue;
      }
      const normalized = normalizeProbeCommand(command);
      const probe = await runVersionProbe(normalized.command, timeoutMs, normalized.args);
      results.push({
        target,
        status: probe.ok && distributionResult?.ok ? "runtime-verified" : "blocked",
        version: probe.version ?? null,
        command,
        distribution: distributionResult?.ok === true,
        reason: probe.ok ? null : probe.reason,
      });
    }
    return {
      schemaVersion: "0.1.0",
      record_type: "live_agent_verification",
      cwd: root,
      target_count: results.length,
      runtime_verified: results.filter((result) => result.status === "runtime-verified").length,
      distribution_only: results.filter((result) => result.status === "distribution-only").length,
      blocked: results.filter((result) => result.status === "blocked").length,
      results,
      production_evidence: false,
    };
  } finally {
    await fsTempRemove(tempRoot);
  }
}

async function fsTempDirectory() {
  return fs.mkdtemp(path.join(os.tmpdir(), "ma-live-agents-"));
}

async function fsTempRemove(directory) {
  await fs.rm(directory, { recursive: true, force: true });
}
