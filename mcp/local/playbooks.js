import fs from "node:fs/promises";
import path from "node:path";
import {
  getBundledDocsPath,
  getBundledMcpPath,
  getBundledNativePlaybooksPath,
  getBundledSkillsPath,
} from "../../src/paths.js";

const playbookRoots = [getBundledDocsPath(), getBundledSkillsPath(), getBundledMcpPath()];

function validateObjectWithArray(parsed, field, label) {
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed[field])) {
    throw new Error(`${label} must be an object with a ${field} array`);
  }

  return parsed;
}

function resolveAllowlistedResourcePath(relativePath) {
  if (typeof relativePath !== "string" || relativePath.trim() === "") {
    throw new Error("Playbook references require a non-empty relative path");
  }
  if (path.isAbsolute(relativePath)) {
    throw new Error(`Playbook reference cannot use an absolute path: ${relativePath}`);
  }

  const resolved = path.resolve(
    path.join(path.dirname(getBundledNativePlaybooksPath()), "..", relativePath),
  );
  const isAllowlisted = playbookRoots.some((root) => {
    const normalizedRoot = path.resolve(root);
    return resolved === normalizedRoot || resolved.startsWith(`${normalizedRoot}${path.sep}`);
  });

  if (!isAllowlisted) {
    throw new Error(
      `Playbook reference must resolve inside bundled docs, skills, or mcp: ${relativePath}`,
    );
  }

  return resolved;
}

function findPack(manifest, packId) {
  return manifest.packs.find((pack) => pack.id === packId) ?? null;
}

function findPackReference(manifest, packId, referenceId) {
  const pack = findPack(manifest, packId);
  if (!pack) {
    return { pack: null, reference: null };
  }

  return {
    pack,
    reference: pack.references.find((item) => item.id === referenceId) ?? null,
  };
}

export async function loadNativePlaybooks() {
  const raw = await fs.readFile(getBundledNativePlaybooksPath(), "utf8");
  const parsed = validateObjectWithArray(JSON.parse(raw), "packs", "mcp/native-playbooks.json");
  const seen = new Set();

  for (const pack of parsed.packs) {
    if (typeof pack.id !== "string" || pack.id.trim() === "") {
      throw new Error("Each native playbook pack requires a non-empty id");
    }
    if (seen.has(pack.id)) {
      throw new Error(`Duplicate native playbook pack: ${pack.id}`);
    }
    if (typeof pack.title !== "string" || pack.title.trim() === "") {
      throw new Error(`Native playbook pack ${pack.id} requires a title`);
    }
    if (!Array.isArray(pack.references)) {
      throw new Error(`Native playbook pack ${pack.id} requires a references array`);
    }

    const referenceIds = new Set();
    for (const reference of pack.references) {
      if (typeof reference.id !== "string" || reference.id.trim() === "") {
        throw new Error(`Native playbook pack ${pack.id} has a reference without an id`);
      }
      if (referenceIds.has(reference.id)) {
        throw new Error(`Duplicate reference ${reference.id} in native playbook pack ${pack.id}`);
      }
      resolveAllowlistedResourcePath(reference.path);
      referenceIds.add(reference.id);
    }

    seen.add(pack.id);
  }

  return parsed;
}

export async function listPlaybookResources() {
  const manifest = await loadNativePlaybooks();
  const resources = ["playbooks://manifest"];

  for (const pack of manifest.packs) {
    resources.push(`playbooks://packs/${pack.id}`);
    for (const reference of pack.references) {
      resources.push(`playbooks://references/${pack.id}/${reference.id}`);
    }
  }

  return resources;
}

export function listPlaybookTools() {
  return [];
}

export async function readPlaybookResource(uri) {
  const manifest = await loadNativePlaybooks();

  if (uri === "playbooks://manifest") {
    return manifest;
  }

  const packMatch = /^playbooks:\/\/packs\/([^/]+)$/.exec(uri);
  if (packMatch) {
    const pack = findPack(manifest, packMatch[1]);
    if (!pack) {
      throw new Error(`Unknown playbooks pack: ${packMatch[1]}`);
    }
    return pack;
  }

  const referenceMatch = /^playbooks:\/\/references\/([^/]+)\/([^/]+)$/.exec(uri);
  if (referenceMatch) {
    const { pack, reference } = findPackReference(manifest, referenceMatch[1], referenceMatch[2]);
    if (!pack || !reference) {
      throw new Error(`Unknown playbooks reference: ${referenceMatch[1]}/${referenceMatch[2]}`);
    }

    const resolvedPath = resolveAllowlistedResourcePath(reference.path);
    const content = await fs.readFile(resolvedPath, "utf8");
    return {
      packId: pack.id,
      referenceId: reference.id,
      title: reference.title,
      path: reference.path,
      content,
    };
  }

  throw new Error(`Unknown playbooks resource: ${uri}`);
}

export async function checkPlaybooksCapability() {
  const manifest = await loadNativePlaybooks();
  let referenceCount = 0;

  for (const pack of manifest.packs) {
    for (const reference of pack.references) {
      await fs.access(resolveAllowlistedResourcePath(reference.path));
      referenceCount += 1;
    }
  }

  return {
    ready: manifest.packs.length > 0,
    detail: `loaded ${manifest.packs.length} playbook pack(s) and ${referenceCount} referenced resource(s)`,
  };
}
