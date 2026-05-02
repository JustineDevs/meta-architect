# Usage Workflow

Use this as a real-world starter prompt from quick start into a project idea. Structured prompts with explicit roles, numbered steps, and required output formats tend to produce more reliable implementation guidance, and reusable prompt templates are a strong fit for MCP-style workflows because they make tools, prompts, and resources composable rather than ad hoc.

## Quick-Start Prompt

```text
$arch I want to build: [PROJECT IDEA]

Context:
- Product type: [web app / mobile app / API / marketplace / agent system / internal tool]
- Users: [who will use it]
- Core problem: [what problem it solves]
- Main features:
  1. [feature one]
  2. [feature two]
  3. [feature three]
- Constraints:
  - Budget: [low / medium / high]
  - Team size: [solo / small / medium]
  - Timeline: [e.g. 2 weeks MVP, 3 months beta]
  - Preferred stack: [optional]
  - Avoid: [optional]
- Quality priorities:
  - [e.g. speed, low cost, security, DX, maintainability, scalability]
- Deployment target:
  - [Vercel / Docker / VPS / AWS / GCP / local-first / hybrid]

Your job:
Design the system as Meta-Architect, not as a chatbot.

Required output:
1. Problem framing
2. Recommended architecture
3. Stack decision with justification
4. System components and responsibilities
5. Data model and storage choices
6. Auth/security considerations
7. DX/UX considerations
8. Delivery plan for v0.1.0
9. Risks and trade-offs
10. Decision log
11. Exact next trigger to run after this

Rules:
- Be concrete, not generic.
- Recommend a stack that fits the constraints.
- Explain trade-offs clearly.
- Optimize for real implementation, not theory only.
- If the idea is underspecified, make the smallest reasonable assumptions and label them.
```

This works well because prompt best-practice guidance consistently recommends assigning a role, separating context from task, numbering required outputs, and constraining the format so the response is reusable inside a workflow rather than just conversational.

## Full Workflow Prompts

After `$arch`, use these in sequence so the project moves from idea to gated execution.

### `$sage`

```text
$sage Use the approved $arch plan for this project:

[PASTE OR SUMMARIZE THE APPROVED ARCH PLAN]

Find proven OSS choices for:
- frontend
- backend
- database
- auth
- validation
- background jobs
- observability
- deployment

Required output:
1. Recommended OSS shortlist by category
2. Why each option fits this project
3. Safer/default option vs higher-performance option
4. What should be avoided
5. Evidence-backed final recommendation set

Rules:
- Prefer mature, practical libraries.
- Avoid trendy choices unless they clearly solve a real constraint.
- Optimize for maintainability and developer speed.
```

Reusable workflow prompts are most effective when each step has a narrow purpose and hands clean structured output into the next stage.

### `$flow`

```text
$flow Use the approved architecture and OSS choices for this project:

[PASTE ARCH + SAGE OUTPUT]

Map the full business logic and system flow.

Required output:
1. Primary user journeys
2. State transitions
3. Backend flow by feature
4. Failure states and edge cases
5. Data consistency concerns
6. Dead ends, bottlenecks, or logic risks
7. Recommended corrections before build

Rules:
- Think like a systems designer.
- Call out ambiguity, race conditions, broken assumptions, and missing states.
- Prefer explicit flows over vague summaries.
```

### `$vet`

```text
$vet Audit this approved plan before build:

[PASTE ARCH + SAGE + FLOW OUTPUT]

Required output:
1. Security blockers
2. Dependency and package risk review
3. Auth/session/token risks
4. Input validation and abuse risks
5. Data protection and privacy concerns
6. Infrastructure and secret-management concerns
7. PASS or FAIL
8. If FAIL, list exact blockers and secure alternatives

Rules:
- Be strict.
- No build approval without clear security posture.
- Do not assume popular libraries are automatically safe.
```

Security-oriented prompts work best when they are framed as explicit audit tasks with pass/fail outputs rather than broad “review this” requests.

### `$vibe`

```text
$vibe Review the approved plan for developer experience and user experience:

[PASTE ARCH + FLOW + VET OUTPUT]

Required output:
1. DX friction points
2. UX friction points
3. Onboarding complexity for developers
4. Product usability risks
5. Recommended simplifications
6. Final DX/UX approval notes

Rules:
- Be practical.
- Optimize for smooth implementation and intuitive user flow.
- Remove complexity that does not create real value.
```

### `$build`

```text
$build Use the approved and security-cleared plan to prepare implementation:

[PASTE FINAL APPROVED PLAN]

Required output:
1. Repo/module structure
2. Task breakdown by workstream
3. Milestones for v0.1.0
4. Exact implementation order
5. Environment variables and setup checklist
6. Testing strategy
7. Release checklist
8. First coding task to start immediately

Rules:
- Do not redesign the system.
- Translate the approved plan into an execution-ready build plan.
- Keep scope aligned with v0.1.0.
```

## Example

Here’s a realistic example for one of your likely project types.

```text
$arch I want to build: an AI-powered smart contract security review workspace for solo founders and small Web3 teams.

Context:
- Product type: web app
- Users: solo founders, indie hackers, small protocol teams
- Core problem: teams want fast architecture-aware smart contract review before paying for full audits
- Main features:
  1. upload or paste smart contracts
  2. AI-assisted review findings with severity and reasoning
  3. project workspace with issue tracking and fix suggestions
- Constraints:
  - Budget: low
  - Team size: solo
  - Timeline: 4 weeks to v0.1.0
  - Preferred stack: TypeScript, Postgres, Vercel-compatible
  - Avoid: overly complex infra
- Quality priorities:
  - speed
  - trust
  - maintainability
  - secure handling of user code
- Deployment target:
  - Vercel + managed Postgres

Your job:
Design the system as Meta-Architect, not as a chatbot.

Required output:
1. Problem framing
2. Recommended architecture
3. Stack decision with justification
4. System components and responsibilities
5. Data model and storage choices
6. Auth/security considerations
7. DX/UX considerations
8. Delivery plan for v0.1.0
9. Risks and trade-offs
10. Decision log
11. Exact next trigger to run after this
```

## Operator Version

If you want a tighter version for daily use, use this compact template:

```text
$arch [PROJECT IDEA]

Users:
[USER TYPE]

Core problem:
[PROBLEM]

Features:
- [F1]
- [F2]
- [F3]

Constraints:
- budget: [X]
- team: [X]
- timeline: [X]
- stack preference: [X]
- avoid: [X]

Priorities:
- [P1]
- [P2]
- [P3]

Output required:
- architecture
- stack with justification
- components
- data model
- security concerns
- DX/UX notes
- v0.1.0 plan
- risks
- decision log
- next trigger
```

## Usage Notes

The key is to start with `$arch` using a prompt that contains problem, users, constraints, priorities, and required output shape, because prompts with role definition, structured context, and explicit output sections are more consistent and easier to chain into later steps like `$sage`, `$flow`, and `$vet`.

Then move through `$sage -> $flow -> $vet -> $vibe -> $build`, with each prompt consuming the approved output of the previous stage, which matches current guidance around modular prompt workflows and MCP-style reusable prompt templates.
