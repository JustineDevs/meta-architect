# AI quality enforcement

Meta-Architect exposes `AIQualityOrchestrator` as a blocking policy boundary for generated code. It records bounded violation and KPI receipts under `.ma/quality/` and exposes them through the local MCP quality resources.

The default checks are deterministic source checks plus the installed Semgrep CLI. The orchestrator has no external provider or model configuration; security and architecture checks are local, deterministic, and fail closed when Semgrep is unavailable.

Every accepted generation must include approved test evidence. `testDrivenGeneration()` requires test generation, approval, code generation, execution, and at least 80% coverage before returning code.

## Usage

```js
import { AIQualityOrchestrator } from "@jstn-sdk/ma";

const quality = new AIQualityOrchestrator({ projectRoot: process.cwd() });
const result = await quality.validate(code, {
  filePath: "src/example.ts",
  hasTests: true,
  testCoverage: 0.9,
});

if (!result.passed) throw new Error(result.reviewReason);
```

The tracked Semgrep baseline is `templates/quality/ai-quality-rules.yml`; a project may provide a stricter `.ma/semgrep/ai-quality-rules.yml`.
