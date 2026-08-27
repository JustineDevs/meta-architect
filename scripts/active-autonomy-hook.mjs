#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import {
  createDefaultActiveAutonomyCore,
  detectPassivePermissionHandoff,
} from "../src/runtime/active-autonomy-core.js";
import { resolveHookProfile } from "../src/runtime/hook-profiles.js";
import { maskSensitiveText } from "../src/runtime/redaction-gateway.js";

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

function extractUserText(payload) {
  const candidates = [
    payload.last_user_message,
    payload["last-user-message"],
    payload.user_message,
    payload.prompt,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }

  if (Array.isArray(payload.messages)) {
    const user = [...payload.messages]
      .reverse()
      .find((message) => message?.role === "user" && typeof message.content === "string");
    return user?.content ?? "";
  }

  return "";
}

function redactAuditPreview(value) {
  if (typeof value !== "string" || !value) return { value: value ?? "", redactions: [] };
  const redacted = maskSensitiveText(value.slice(0, 200));
  return {
    value: redacted.sanitizedText,
    redactions: redacted.replacements.map(({ placeholder, placeholderBase }) => ({
      placeholder,
      placeholderBase,
    })),
  };
}

async function appendAudit(cwd, entry) {
  const auditDir = path.join(cwd, ".ma", "hooks");
  await fs.mkdir(auditDir, { recursive: true });
  const assistantPreview = redactAuditPreview(entry.assistantPreview);
  const userPreview = redactAuditPreview(entry.userPreview);
  const safeEntry = {
    ...entry,
    ...(entry.assistantPreview !== undefined ? { assistantPreview: assistantPreview.value } : {}),
    ...(entry.userPreview !== undefined ? { userPreview: userPreview.value } : {}),
    previewRedactions: {
      assistant: assistantPreview.redactions,
      user: userPreview.redactions,
    },
  };
  await fs.appendFile(
    path.join(auditDir, "audit.log"),
    `${JSON.stringify({ timestamp: new Date().toISOString(), ...safeEntry })}\n`,
    "utf8",
  );
}

function classifyFinding(file) {
  const value = String(file ?? "").toLowerCase();
  if (/(node_modules|site-packages|vendor)/.test(value)) return "dependency";
  if (/(dist|build|\.next|coverage|cache)/.test(value)) return "generated";
  if (/(compat|legacy|history)/.test(value)) return "compatibility";
  return "source";
}

async function writeBlockingReceipt(cwd, receipt) {
  const receiptDir = path.join(cwd, ".ma", "hooks", "receipts");
  await fs.mkdir(receiptDir, { recursive: true });
  const receiptPath = path.join(receiptDir, `active-autonomy-${Date.now()}.json`);
  await fs.writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  return path.relative(cwd, receiptPath);
}

const payload = await readStdinJson();
const profile = resolveHookProfile(payload.profile);
const cwd = path.resolve(
  payload.project_root ||
    payload.cwd ||
    payload.working_directory ||
    process.env.MA_ROOT ||
    process.cwd(),
);
const broadScan =
  profile.scanScope === "broad" ||
  payload.broad_scan === true ||
  process.env.MA_HOOK_BROAD_SCAN === "1";
const ignoredArtifactClasses = [
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  "cache",
  "venv",
  ".venv",
  "site-packages",
  "vendored bundles",
];
const assistantText = extractAssistantText(payload);
const userText = extractUserText(payload);
const blocked =
  profile.block && detectPassivePermissionHandoff(assistantText, createDefaultActiveAutonomyCore());

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

const matchedFiles = Array.isArray(payload.files) ? payload.files : [];
const receiptPath = blocked
  ? await writeBlockingReceipt(cwd, {
      schemaVersion: "0.1.0",
      record_type: "hook_receipt",
      hook: "active-autonomy",
      ruleId: "active_autonomy_passive_handoff",
      scanRoot: cwd,
      include: broadScan ? ["all"] : ["active-project"],
      exclude: broadScan ? [] : ignoredArtifactClasses,
      matchedFiles: matchedFiles.map((file) => ({
        path: String(file.path ?? file),
        line: Number.isInteger(file.line) ? file.line : null,
        classification: classifyFinding(file.path ?? file),
      })),
      classification: matchedFiles.some((file) => classifyFinding(file.path ?? file) === "source")
        ? "source"
        : "false_positive_candidate",
      blocked: true,
      reason: result.reason,
      recommendedAction: "Rewrite the response to continue the safe branch and verify it.",
      suppressionPolicy: "No suppression without an explicit rationale.",
      createdAt: new Date().toISOString(),
      profile: profile.id,
    })
  : null;

if (!profile.readOnly)
  await appendAudit(cwd, {
    hook: "active-autonomy",
    scanRoot: cwd,
    scope: broadScan ? "broad-opt-in" : "active-project",
    ignoredArtifactClasses: broadScan ? [] : ignoredArtifactClasses,
    event: payload.type || payload.event || "unknown",
    decision: result.decision,
    stopReason: result.stopReason,
    assistantPreview: assistantText,
    userPreview: userText,
  });

process.stdout.write(
  `${JSON.stringify({
    ...result,
    scanRoot: cwd,
    scope: broadScan ? "broad-opt-in" : "active-project",
    ignoredArtifactClasses: broadScan ? [] : ignoredArtifactClasses,
    profile: profile.id,
    readOnly: profile.readOnly,
    ...(receiptPath ? { receiptPath } : {}),
  })}\n`,
);
