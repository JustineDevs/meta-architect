#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { createBudgetedContext } from "../src/runtime/context-economy-core.js";
import { maskSensitiveText } from "../src/runtime/redaction-gateway.js";

const root = path.resolve(process.env.MA_ROOT || process.cwd());
const contextRoot = path.join(root, ".ma", "context");

async function read(relative, fallback = null) {
  try {
    return await fs.readFile(path.join(contextRoot, relative), "utf8");
  } catch {
    return fallback;
  }
}

const [project, brief, commands, learning] = await Promise.all([
  read("project-index.json"),
  read("agent-brief.md", ""),
  read("commands.json"),
  fs.readFile(path.join(root, ".ma", "learning", "records.jsonl"), "utf8").catch(() => ""),
]);
const preferences = await fs
  .readFile(path.join(root, ".ma", "memory", "preferences.json"), "utf8")
  .catch(() => "{}");
const records = learning
  .split("\n")
  .filter(Boolean)
  .slice(-3)
  .map((line) => {
    try {
      const value = JSON.parse(line);
      return { claim: value.claim, status: value.status, authority: "learning_memory" };
    } catch {
      return null;
    }
  })
  .filter(Boolean);

const result = {
  record_type: "context_hydration",
  root,
  loaded: {
    projectIndex: Boolean(project),
    agentBrief: Boolean(brief),
    commands: Boolean(commands),
    learningRecords: records.length,
    preferences: preferences !== "{}",
  },
  skipped: ["repository-wide source scan", "full Obsidian vault"],
  stale: project
    ? (() => {
        try {
          return JSON.parse(project).freshness?.status === "stale";
        } catch {
          return true;
        }
      })()
    : true,
  authority: "generated_context",
  context: {
    project: project ? maskSensitiveText(project).sanitizedText : null,
    brief: maskSensitiveText(brief).sanitizedText,
    commands: commands ? maskSensitiveText(commands).sanitizedText : null,
    learning: records,
    preferences: (() => {
      try {
        return JSON.parse(preferences).preferences ?? {};
      } catch {
        return {};
      }
    })(),
  },
};
const budgeted = createBudgetedContext({
  budgetChars: Number(process.env.MA_CONTEXT_BUDGET_CHARS || 12000),
  topic: process.env.MA_CONTEXT_TOPIC,
  items: [
    { id: "agent-brief", tier: 1, topic: "brief", text: brief },
    { id: "commands", tier: 3, topic: "commands", text: commands ?? "" },
    { id: "learning", tier: 4, topic: "learning", text: JSON.stringify(records) },
    { id: "preferences", tier: 4, topic: "preferences", text: preferences },
    { id: "project-index", tier: 5, topic: "project", text: project ?? "" },
  ],
});
result.budget = budgeted;
process.stdout.write(`${JSON.stringify(result)}\n`);
