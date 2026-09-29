import { MCPServer } from "mcp-use";
import { z } from "zod";

const server = new MCPServer({
  name: "meta-architect-mcp",
  title: "Meta-Architect",
  version: "0.15.3",
  description:
    "Read-only workflow guidance for using Meta-Architect to plan, execute, verify, and record AI coding work.",
  instructions:
    "Use the workflow tool when a user wants to turn a coding goal into a safe, evidence-backed next action. This server does not access or modify a user's repository.",
  websiteUrl: "https://ma.jstn.site",
  skills: true,
  // Keep the public deployment bound to its canonical hostname. This enables
  // mcp-use's Host-header validation and prevents DNS-rebinding requests from
  // reaching the MCP handler when the server is run directly or behind an edge.
  allowedHosts: [
    "ma.jstn.site",
    "calm-cloud-0d8ea.run.mcp-use.com",
    "calm-cloud-0d8ea.run.mcp-use.com:3000",
    "localhost",
    "localhost:3000",
    "127.0.0.1",
    "127.0.0.1:3000",
  ],
  // Browser clients may send Origin on MCP POST requests. Requests without an
  // Origin (the normal native-client case) remain valid, while browser origins
  // are restricted to known first-party MCP hosts.
  allowedOrigins: [
    "ma.jstn.site",
    "chatgpt.com",
    "chat.openai.com",
    "platform.openai.com",
    "claude.ai",
    "www.claude.ai",
  ],
  icons: [
    {
      src: "icon.svg",
      mimeType: "image/svg+xml",
      sizes: ["512x512"],
    },
  ],
});

const workflowStages = [
  "install",
  "setup",
  "goal",
  "execute",
  "verify",
  "record",
] as const satisfies readonly string[];
type WorkflowStage = (typeof workflowStages)[number];

const nextActions: Record<WorkflowStage, string> = {
  install: "Install the latest Meta-Architect package and confirm the active executable path.",
  setup: "Run `ma setup` from the project directory and inspect the generated `.ma/` state.",
  goal: "State one concrete, bounded goal with acceptance criteria and explicit safety constraints.",
  execute: "Let Maestro choose one safe action, then review the proposed action before continuing.",
  verify: "Run targeted tests or checks that directly prove the acceptance criteria.",
  record: "Capture the changed files, verification evidence, and any remaining risks.",
};

const planInputSchema = z.strictObject({
  goal: z
    .string()
    .trim()
    .min(1)
    .max(4000)
    .describe("One concrete coding or repository goal to work toward"),
  stage: z
    .enum(workflowStages)
    .optional()
    .describe("Current Meta-Architect workflow stage; omit when unknown"),
  evidence: z
    .array(z.string().trim().min(1).max(1000))
    .max(10)
    .default([])
    .describe("Short facts already verified"),
});

type PlanInput = z.infer<typeof planInputSchema>;

const planOutputSchema = z.object({
  workflow: z.array(z.string()),
  currentStage: z.string(),
  nextAction: z.string(),
  acceptanceChecks: z.array(z.string()),
  guardrails: z.array(z.string()),
});

server.tool(
  {
    name: "meta_architect_plan_next_action",
    title: "Plan the next safe action",
    description:
      "Turn one coding goal and its verified evidence into a bounded Meta-Architect workflow step. This tool is read-only and does not access files, run commands, or modify repositories.",
    inputSchema: planInputSchema,
    outputSchema: planOutputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ goal, stage, evidence }: PlanInput) => {
    const currentStage = stage ?? "goal";
    const output = {
      workflow: workflowStages.map((item) => `${item}: ${nextActions[item]}`),
      currentStage: String(currentStage),
      nextAction: `${nextActions[currentStage]}\n\nGoal: ${goal}\nVerified evidence: ${evidence.length > 0 ? evidence.join("; ") : "None supplied; inspect the project before acting."}`,
      acceptanceChecks: [
        "The requested behavior is demonstrated with a targeted test or smoke check.",
        "The verification output is recorded alongside the changed files.",
        "No unrelated files or user-owned changes are overwritten.",
      ],
      guardrails: [
        "Inspect before editing.",
        "Keep the change scoped to the stated goal.",
        "Do not delete, publish, or deploy without explicit approval and fresh verification.",
      ],
    };
    return {
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      structuredContent: output,
    };
  },
);

server.get("/.well-known/openai-apps-challenge", (c) => {
  const token = process.env.OPENAI_APPS_CHALLENGE;
  return token ? c.text(token) : c.text("", 404);
});

const guideInputSchema = z.strictObject({
  topic: z
    .enum(["install", "setup", "autonomous-work", "verification", "plugin-hosting"])
    .describe("The Meta-Architect topic the user needs help with"),
});

type GuideInput = z.infer<typeof guideInputSchema>;

const guideOutputSchema = z.object({
  topic: guideInputSchema.shape.topic,
  guidance: z.string(),
});

server.tool(
  {
    name: "meta_architect_get_guide",
    title: "Get Meta-Architect guidance",
    description:
      "Return concise, read-only guidance for installing, setting up, using, verifying, or hosting Meta-Architect.",
    inputSchema: guideInputSchema,
    outputSchema: guideOutputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ topic }: GuideInput) => {
    const guides: Record<GuideInput["topic"], string> = {
      install:
        "Install with `npm install --global @jstn-sdk/ma@latest`, then run `ma --version` to confirm the active binary.",
      setup:
        "From the project directory, run `ma setup`. Existing user-owned files are preserved; inspect `.ma/` state before starting work.",
      "autonomous-work":
        "Give Maestro one bounded goal, require a visible next action, and keep verification evidence in the task record.",
      verification:
        "Use focused tests first, then the project check/build. Record the exact commands and results before declaring completion.",
      "plugin-hosting":
        "A hosted ChatGPT plugin needs a stable public HTTPS MCP endpoint, accurate tool metadata, domain verification, and public policy/support URLs. Installing the CLI alone does not register a hosted plugin.",
    };
    const guidance = guides[topic];
    const output = { topic, guidance };
    return {
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      structuredContent: output,
    };
  },
);

export default server;
