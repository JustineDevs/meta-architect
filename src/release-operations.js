import { promisify } from "node:util";
import { safeExecFile } from "./process-utils.js";

const execFileAsync = promisify(safeExecFile);
const branchPattern = /^[A-Za-z0-9._/-]+$/;

function assertBranch(value, label) {
  if (typeof value !== "string" || !branchPattern.test(value) || value.includes("..")) {
    throw new Error(`${label} is not a safe branch name`);
  }
}

export function getGitOperation(sourceBranch, targetBranch) {
  assertBranch(sourceBranch, "Source branch");
  assertBranch(targetBranch, "Target branch");
  return {
    command: "git",
    args: ["merge", "--no-ff", "--no-edit", "--", sourceBranch],
    display: `git merge --no-ff --no-edit -- ${sourceBranch}`,
    sourceBranch,
    targetBranch,
  };
}

export async function inspectGitOperation(root, sourceBranch, targetBranch) {
  const operation = getGitOperation(sourceBranch, targetBranch);
  try {
    const [branch, status] = await Promise.all([
      execFileAsync("git", ["branch", "--show-current"], {
        cwd: root,
        encoding: "utf8",
        timeout: 10_000,
      }),
      execFileAsync("git", ["status", "--porcelain"], {
        cwd: root,
        encoding: "utf8",
        timeout: 10_000,
      }),
      execFileAsync("git", ["rev-parse", "--verify", `refs/heads/${sourceBranch}`], {
        cwd: root,
        encoding: "utf8",
        timeout: 10_000,
      }),
    ]);
    return {
      ...operation,
      available: true,
      currentBranch: branch.stdout.trim(),
      clean: status.stdout.trim() === "",
      sourceExists: true,
      blockers: status.stdout.trim() === "" ? [] : ["working tree is not clean"],
    };
  } catch (error) {
    return {
      ...operation,
      available: false,
      currentBranch: "",
      clean: false,
      sourceExists: false,
      blockers: [error?.stderr?.trim() || "Git preflight failed"],
    };
  }
}

export async function executeGitOperation(root, operation) {
  const result = await execFileAsync(operation.command, operation.args, {
    cwd: root,
    encoding: "utf8",
    timeout: 30_000,
  });
  return { ...operation, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}
