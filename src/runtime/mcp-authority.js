import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { writeJson } from "../fs-utils.js";
import { getRuntimeWritePath } from "../paths.js";
import { resolveHookProfile } from "./hook-profiles.js";
import { maskSensitiveText } from "./redaction-gateway.js";
import { queueMailboxProposal } from "./runtime-state.js";

const writePolicies = {
  "state.sync_release_status": "state-write",
  "state.append_decision": "state-write",
  "memory.store_note": "memory-write",
  "team_run.submit_task": "task-control",
  "team_run.control_task": "task-control",
};

function getField(options, camel, snake) {
  return options?.[camel] ?? options?.[snake];
}

function getProfile(options) {
  const requested = getField(options, "profile", "profile") ?? process.env.MA_MCP_PROFILE;
  return requested ? resolveHookProfile(requested) : resolveHookProfile();
}

function validateMetadata(options) {
  const metadata = {
    actor: getField(options, "actor", "actor"),
    authority: options?.authority ?? getField(options, "authorityBoundary", "authority_boundary"),
    reason: getField(options, "reason", "reason"),
    evidence: getField(options, "evidence", "evidence"),
  };
  const missing = Object.entries(metadata)
    .filter(([, value]) => value == null || (typeof value === "string" && value.trim() === ""))
    .map(([key]) => key);
  return { metadata, missing };
}

function receiptPath() {
  return path.join(getRuntimeWritePath("mcp", "receipts"), `${Date.now()}-${randomUUID()}.json`);
}

async function writeAuditReceipt({ tool, classification, profile, metadata, outcome, reason }) {
  const safe = maskSensitiveText(
    JSON.stringify({
      actor: metadata.actor,
      authority: metadata.authority,
      reason: metadata.reason,
      evidence: metadata.evidence,
    }),
  ).sanitizedText;
  const receipt = {
    schemaVersion: "0.1.0",
    record_type: "mcp_write_audit_receipt",
    tool,
    classification,
    profile: profile.id,
    outcome,
    denial_reason: reason ?? null,
    metadata: JSON.parse(safe),
    recordedAt: new Date().toISOString(),
  };
  const target = receiptPath();
  await writeJson(target, receipt);
  await fs.chmod(target, 0o600).catch(() => {});
  return target;
}

export function listMcpWritePolicies() {
  return Object.entries(writePolicies).map(([tool, classification]) => ({ tool, classification }));
}

export function mcpWriteCapabilityStatus() {
  const profile = resolveHookProfile(
    process.env.MA_MCP_PROFILE ?? process.env.MA_PROFILE ?? "local",
  );
  return {
    profile: profile.id,
    readOnly: profile.readOnly === true,
    tools: listMcpWritePolicies(),
    detail: profile.readOnly
      ? `MCP writes disabled by ${profile.id} profile`
      : `MCP writes require actor, authority, reason, and evidence in ${profile.id} profile`,
  };
}

export async function loadMcpAuditReceipts() {
  const root = getRuntimeWritePath("mcp", "receipts");
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  const receipts = [];
  for (const entry of entries.filter((item) => item.isFile() && item.name.endsWith(".json"))) {
    try {
      receipts.push(JSON.parse(await fs.readFile(path.join(root, entry.name), "utf8")));
    } catch {
      // Ignore incomplete receipts; doctor can still report the directory.
    }
  }
  return receipts.sort((a, b) => `${a.recordedAt}`.localeCompare(`${b.recordedAt}`));
}

export async function withMcpWriteGate({ tool, options = {}, payload = {} }, operation) {
  const classification = writePolicies[tool];
  if (!classification) throw new Error(`Unknown MCP write tool: ${tool}`);
  const profile = getProfile(options);
  const { metadata, missing } = validateMetadata(options);

  if (profile.readOnly === true) {
    const auditReceipt = await writeAuditReceipt({
      tool,
      classification,
      profile,
      metadata,
      outcome: "denied",
      reason: "profile_read_only",
    });
    return { proposed: false, denied: true, reason: "profile_read_only", auditReceipt };
  }

  if (missing.length > 0) {
    const proposalPath = await queueMailboxProposal({
      actor: metadata.actor ?? "mcp-unknown",
      kind: `mcp-${classification}`,
      payload: { tool, payload, missingAuthority: missing },
    });
    const auditReceipt = await writeAuditReceipt({
      tool,
      classification,
      profile,
      metadata,
      outcome: "proposed",
      reason: `missing_authority:${missing.join(",")}`,
    });
    return { proposed: true, proposalPath, auditReceipt, reason: "missing_authority" };
  }

  const result = await operation(metadata);
  const auditReceipt = await writeAuditReceipt({
    tool,
    classification,
    profile,
    metadata,
    outcome: result?.proposed ? "proposed" : "allowed",
    reason: result?.proposed ? "leader_authority_required" : null,
  });
  return { ...result, auditReceipt };
}
