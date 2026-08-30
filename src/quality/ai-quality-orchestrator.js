import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { writeJson } from "../fs-utils.js";
import { packageRoot } from "../paths.js";
import { safeSpawn } from "../process-utils.js";

const QUALITY_ROOT = path.join(".ma", "quality");
let appendQueue = Promise.resolve();

function violation(rule, severity, message, context, fix) {
  return {
    rule,
    severity,
    message,
    ...(context?.filePath ? { location: { file: context.filePath, line: 1, column: 1 } } : {}),
    ...(fix ? { fix } : {}),
  };
}

function staticViolations(code, context) {
  const findings = [];
  if (/\bfetch\s*\(/.test(code) && !/AbortController|\btimeout\b|setTimeout/.test(code))
    findings.push(
      violation(
        "network-calls-must-have-timeouts",
        "critical",
        "Network calls must use an abort or timeout boundary.",
        context,
        "Use AbortController with a bounded timeout.",
      ),
    );
  if (/\b(?:eval|Function)\s*\(/.test(code))
    findings.push(
      violation(
        "no-dynamic-code-execution",
        "critical",
        "Dynamic code execution is forbidden.",
        context,
      ),
    );
  if (/:\s*any\b/.test(code))
    findings.push(
      violation(
        "no-any-types",
        "error",
        "TypeScript any is forbidden in generated code.",
        context,
        "Use a specific type or unknown with a type guard.",
      ),
    );
  if (/\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{16,}|AIza[0-9A-Za-z-_]{20,})\b/.test(code))
    findings.push(
      violation(
        "no-hardcoded-secrets",
        "critical",
        "A credential-shaped value was found in generated code.",
        context,
      ),
    );
  if (
    (context?.filePath?.includes("/controllers/") || context?.filePath?.includes("/routes/")) &&
    /db\.collection|sequelize\.query|prisma\.\w+/.test(code)
  )
    findings.push(
      violation(
        "no-direct-db-access-from-controllers",
        "error",
        "Controllers must use a service boundary for database access.",
        context,
      ),
    );
  return findings;
}

function calculateQualityScore(kpis) {
  const deletion = Math.min(
    (Math.max(0, kpis.linesDeleted) / Math.max(kpis.linesAdded, 1)) * 30,
    30,
  );
  const stability = 30 / (1 + Math.abs(kpis.p95LatencyDelta) / 100);
  const security =
    kpis.securityIssuesFound === 0
      ? 20
      : Math.min(kpis.securityIssuesFixed / kpis.securityIssuesFound, 1) * 20;
  const coverage = Math.max(0, Math.min(kpis.testCoverage, 1)) * 20;
  const cost = kpis.cloudCostDelta <= 0 ? 10 : Math.max(0, 10 - kpis.cloudCostDelta * 10);
  return (
    Math.round(
      Math.max(0, Math.min(100, deletion + stability + security + coverage + cost)) * 100,
    ) / 100
  );
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = safeSpawn(command, args, {
      cwd: options.cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${command} timed out`));
    }, options.timeoutMs ?? 30_000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout: stdout.toString(), stderr: stderr.toString() });
    });
  });
}

export class AIQualityOrchestrator {
  constructor(config = {}) {
    this.config = { projectRoot: process.cwd(), requireTests: true, ...config };
  }

  async validate(code, context = {}) {
    if (typeof code !== "string" || !code.trim())
      throw new Error("Quality validation requires generated code");
    const violations = staticViolations(code, context);
    const semgrep = await this.runSemgrep(code, context);
    violations.push(...semgrep.violations);
    const architecture = await this.runArchUnit(code, context);
    violations.push(...(architecture.violations ?? []));
    if (this.config.requireTests && !context.testEvidence?.approved)
      violations.push(
        violation(
          "tests-before-code",
          "critical",
          "Generated code has no approved test evidence.",
          context,
          "Provide approved tests before accepting generated code.",
        ),
      );
    const kpis = {
      linesDeleted: 0,
      linesAdded: code.split("\n").length,
      cloudCostDelta: 0,
      p95LatencyDelta: 0,
      testCoverage: Number(context.testCoverage ?? 0),
      securityIssuesFound: violations.filter((v) => v.severity === "critical").length,
      securityIssuesFixed: 0,
      qualityScore: 0,
    };
    kpis.qualityScore = calculateQualityScore(kpis);
    const blocked =
      violations.some((item) => item.severity === "critical" || item.severity === "error") ||
      kpis.qualityScore < (this.config.qualityScoreThreshold ?? 60);
    const result = {
      passed: !blocked,
      score: kpis.qualityScore,
      violations,
      kpis,
      reviewRequired: blocked,
      ...(blocked ? { reviewReason: "One or more mandatory quality gates failed." } : {}),
    };
    await this.#append("violations.json", {
      schemaVersion: "0.1.0",
      record_type: "ai_quality_violations",
      recordedAt: new Date().toISOString(),
      violations,
    });
    await this.#append("kpis.json", {
      schemaVersion: "0.1.0",
      record_type: "ai_quality_kpis",
      recordedAt: new Date().toISOString(),
      kpis,
    });
    return result;
  }

  async runSemgrep(code, context = {}) {
    if (typeof this.config.semgrepRunner === "function")
      return this.config.semgrepRunner(code, context);
    const root = context.projectRoot ?? this.config.projectRoot;
    const projectRules = path.join(root, ".ma", "semgrep", "ai-quality-rules.yml");
    let rules = context.rulesPath ?? projectRules;
    if (!context.rulesPath) {
      try {
        await fs.access(projectRules);
      } catch (error) {
        if (error.code === "ENOENT") {
          rules = path.join(packageRoot, "templates", "quality", "ai-quality-rules.yml");
        } else {
          return {
            passed: false,
            blocked: true,
            available: false,
            violations: [
              violation(
                "semgrep-rules-error",
                "critical",
                `Semgrep rules could not be read: ${error.message}`,
                context,
              ),
            ],
          };
        }
      }
    }
    const input = path.join(root, ".ma", "quality", `.scan-${randomUUID()}.ts`);
    await fs.mkdir(path.dirname(input), { recursive: true });
    await fs.writeFile(input, code, { mode: 0o600 });
    try {
      const result = await runCommand("semgrep", ["--config", rules, "--json", "--quiet", input], {
        cwd: root,
        timeoutMs: this.config.timeoutMs,
      });
      if (result.code === 0)
        return { passed: true, blocked: false, available: true, violations: [] };
      if (result.code === 1) {
        const parsed = JSON.parse(result.stdout || "{}");
        return {
          passed: false,
          blocked: true,
          available: true,
          violations: (parsed.results ?? []).map((item) =>
            violation(
              item.check_id,
              "error",
              item.extra?.message ?? "Semgrep rule failed",
              context,
              item.extra?.fix,
            ),
          ),
        };
      }
      return {
        passed: false,
        blocked: true,
        available: true,
        violations: [
          violation(
            "semgrep-error",
            "critical",
            result.stderr.trim() || "Semgrep failed to execute",
            context,
          ),
        ],
      };
    } catch (error) {
      return {
        passed: false,
        blocked: true,
        available: false,
        violations: [
          violation(
            "semgrep-unavailable",
            "critical",
            `Semgrep is unavailable: ${error.message}`,
            context,
          ),
        ],
      };
    } finally {
      await fs.rm(input, { force: true });
    }
  }

  async runArchUnit(code, context = {}) {
    const violations = staticViolations(code, context).filter(
      (item) => item.rule === "no-direct-db-access-from-controllers",
    );
    return { passed: violations.length === 0, blocked: violations.length > 0, violations };
  }

  async testDrivenGeneration(
    requirement,
    { generateTests, generateCode, approveTests, runTests } = {},
  ) {
    if (
      ![generateTests, generateCode, approveTests, runTests].every((fn) => typeof fn === "function")
    )
      throw new Error(
        "Test-driven generation requires explicit test, approval, code, and runner functions",
      );
    const tests = await generateTests(requirement);
    if (!(await approveTests(tests))) throw new Error("Tests were not approved");
    const code = await generateCode(requirement, tests);
    const result = await runTests(tests, code);
    if (!result?.allPassed || Number(result.coverage ?? 0) < 0.8)
      throw new Error("Approved tests did not pass with 80% coverage");
    return { tests, code };
  }

  async generateCursorRules(projectRoot) {
    const content = `# AI Engineering Quality Standards\n\n## Enforced\n- Network calls require bounded AbortController timeouts.\n- Dynamic code execution and hardcoded credentials are forbidden.\n- User input must be validated and logs sanitized.\n- Database access belongs behind a service boundary.\n- Tests must be approved before generated production code.\n- Quality failures block acceptance.\n`;
    await fs.mkdir(projectRoot, { recursive: true });
    await fs.writeFile(path.join(projectRoot, ".cursorrules"), content, { mode: 0o644 });
    return content;
  }

  async calculateQualityScore(kpis) {
    return calculateQualityScore(kpis);
  }

  async #append(name, record) {
    const file = path.join(this.config.projectRoot, QUALITY_ROOT, name);
    const append = async () => {
      let records = [];
      try {
        records = JSON.parse(await fs.readFile(file, "utf8"));
      } catch {
        /* first record */
      }
      if (!Array.isArray(records)) records = [];
      records.push(record);
      await writeJson(file, records.slice(-100));
    };
    appendQueue = appendQueue.then(append, append);
    await appendQueue;
  }
}

export { calculateQualityScore, staticViolations };
