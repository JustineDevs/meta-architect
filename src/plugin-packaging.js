import fs from "node:fs/promises";
import path from "node:path";

const LOCAL_PATH_PATTERN = /^(?:[A-Za-z]:[\\/]|[\\/]|file:\/\/)/;
const MARKDOWN_LINK_PATTERN = /\[[^\]]*\]\(\s*([^\s)]+)(?:\s+"[^"]*")?\s*\)/g;

function isWithin(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function isAbsoluteLocalPath(value) {
  return typeof value === "string" && LOCAL_PATH_PATTERN.test(value);
}

export function findUnsupportedLocalSkillReferences(value) {
  if (typeof value !== "string") return [];
  const matches = [];
  for (const match of value.matchAll(MARKDOWN_LINK_PATTERN)) {
    const reference = match[1];
    if (isAbsoluteLocalPath(reference) && /(?:SKILL\.md|skills?\/)/i.test(reference)) {
      matches.push(reference);
    }
  }
  return matches;
}

export function unsupportedLocalSkillReferenceMessage(reference) {
  return [
    `Unsupported local skill-path invocation: ${reference}`,
    "ChatGPT Desktop cannot resolve a Codex CLI filesystem link from a chat message.",
    "Install Meta-Architect from the repository marketplace at .agents/plugins/marketplace.json, or upload the plugin package, then invoke the installed plugin instead.",
    "Codex CLI can continue using $maestro after the local skill is installed.",
  ].join(" ");
}

export function assertSupportedSkillInvocation(value) {
  const [reference] = findUnsupportedLocalSkillReferences(value);
  if (reference) throw new Error(unsupportedLocalSkillReferenceMessage(reference));
  return true;
}

function collectStringValues(value, output = []) {
  if (typeof value === "string") {
    output.push(value);
  } else if (Array.isArray(value)) {
    for (const entry of value) collectStringValues(entry, output);
  } else if (value && typeof value === "object") {
    for (const entry of Object.values(value)) collectStringValues(entry, output);
  }
  return output;
}

function assertNoAbsoluteManifestPaths(value) {
  for (const entry of collectStringValues(value)) {
    if (isAbsoluteLocalPath(entry)) {
      throw new Error(
        `Portable plugin metadata contains an absolute local path: ${entry}. Use a ./ path relative to the plugin root.`,
      );
    }
  }
}

async function assertNoSymlinks(root, current = root) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    const target = path.join(current, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(
        `Portable plugin contains a symlink: ${path.relative(root, target)}. Materialize the skill mirror before publishing to ChatGPT Desktop.`,
      );
    }
    if (entry.isDirectory()) await assertNoSymlinks(root, target);
  }
}

export async function validatePortablePlugin(pluginRoot) {
  const manifestPath = path.join(pluginRoot, "plugin.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  if (manifest.$schema !== "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json") {
    throw new Error("Portable plugin manifest must declare the Agent Plugins 1.0.0 schema");
  }
  for (const key of ["name", "version", "description"]) {
    if (typeof manifest[key] !== "string" || manifest[key].length === 0) {
      throw new Error(`Portable plugin manifest is missing ${key}`);
    }
  }
  assertNoAbsoluteManifestPaths(manifest);
  await assertNoSymlinks(pluginRoot);
  await fs.access(path.join(pluginRoot, "skills", "maestro", "SKILL.md"));
  return manifest;
}

export async function validateLocalMarketplace(marketplacePath, { sourceRoot = null } = {}) {
  const marketplaceRoot = path.resolve(sourceRoot ?? path.dirname(marketplacePath));
  const marketplace = JSON.parse(await fs.readFile(marketplacePath, "utf8"));
  if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length === 0) {
    throw new Error("Marketplace must define at least one plugin");
  }

  for (const plugin of marketplace.plugins) {
    const source = plugin?.source;
    if (!source || typeof source !== "object" || source.source !== "local") continue;
    if (typeof source.path !== "string" || !source.path.startsWith("./")) {
      throw new Error(
        `Local marketplace entry ${plugin.name ?? "(unnamed)"} must use a ./ relative source.path. Absolute filesystem paths are not portable to ChatGPT Desktop.`,
      );
    }
    const resolvedPluginRoot = path.resolve(marketplaceRoot, source.path);
    if (!isWithin(marketplaceRoot, resolvedPluginRoot)) {
      throw new Error(
        `Local marketplace entry ${plugin.name ?? "(unnamed)"} escapes the marketplace root: ${source.path}`,
      );
    }
    await validatePortablePlugin(resolvedPluginRoot);
  }
  return marketplace;
}
