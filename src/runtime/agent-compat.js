import { createRequire } from "node:module";
import { Agents } from "@jstn-sdk/agents";

const require = createRequire(import.meta.url);
const agentCompatMetadata = require("@jstn-sdk/agents/package.json");

export const agentCompatPackage = "@jstn-sdk/agents";
export const agentCompatVersion = agentCompatMetadata.version;

export function listAgentCompatAdapters() {
  return Agents.list().map(({ id, vendor, product, surface, support, verification }) => ({
    id,
    vendor,
    product,
    surface,
    support,
    verification,
  }));
}

export function detectAgentEnvironments(root) {
  return Agents.detect(root);
}

export function compileAgentIntegrations(manifest, options = {}) {
  return Agents.compile(manifest, options);
}

export function validateAgentIntegrations(root, options = {}) {
  return Agents.validate(root, options);
}
