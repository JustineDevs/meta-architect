#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import {
  createDefaultActiveAutonomyCore,
  detectPassivePermissionHandoff,
} from "../src/runtime/active-autonomy-core.js";

const DEFAULT_RESPONSE =
  "AUTO-CONTINUE: continue the current safe branch, execute the next reversible step, then verify before reporting.";

async function readStdinJson() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    return {
      type: "invalid-hook-payload",
      raw,
      parseError: error instanceof Error ? error.message : String(error),
    };
  }
}

function extractAssistantText(payload) {
  const candidates = [
    payload.last_assistant_message,
    payload["last-assistant-message"],
    payload.message,
    payload.text,
    payload.output,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  if (Array.isArray(payload.messages)) {
    const assistant = [...payload.messages]
      .reverse()
      .find((message) => message?.role === "assistant" && typeof message.content === "string");
    return assistant?.content ?? "";
  }

  return "";
}

async function appendAudit(cwd, entry) {
  const auditDir = path.join(cwd, ".ma", "hooks");
  await fs.mkdir(auditDir, { recursive: true });
  await fs.appendFile(
    path.join(auditDir, "audit.log"),
    `${JSON.stringify({ timestamp: new Date().toISOString(), ...entry })}\n`,
    "utf8",
  );
}

const payload = await readStdinJson();
const cwd = payload.cwd || payload.working_directory || process.env.MA_ROOT || process.cwd();
const assistantText = extractAssistantText(payload);
const blocked = detectPassivePermissionHandoff(assistantText, createDefaultActiveAutonomyCore());

const result = blocked
  ? {
      decision: "block",
      reason: DEFAULT_RESPONSE,
      stopReason: "active_autonomy_passive_handoff",
      systemMessage:
        "Meta-Architect Active Autonomy blocked passive permission-handoff wording on an AUTO-CONTINUE branch.",
    }
  : {
      decision: "approve",
      reason: "active_autonomy_no_passive_handoff_detected",
    };

await appendAudit(cwd, {
  hook: "active-autonomy",
  event: payload.type || payload.event || "unknown",
  decision: result.decision,
  stopReason: result.stopReason,
  assistantPreview: assistantText.slice(0, 200),
});

process.stdout.write(`${JSON.stringify(result)}\n`);
