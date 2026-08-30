#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = path.join(repoRoot, "skills");
const sourcePluginRoot = path.join(repoRoot, "plugins", "meta-architect");
const packageJson = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf8"));

const TARGETS = {
  codex: {
    support: "native",
    description: "Codex plugin bundle with native skills, app metadata, and MCP metadata.",
    install:
      "Copy this directory to a Codex plugin location or load it with the host plugin loader.",
    publish: "Publish the generated directory through the Codex plugin distribution flow.",
  },
  "claude-code": {
    support: "native",
    description: "Claude Code marketplace repository containing a native plugin source.",
    install:
      "/plugin marketplace add <owner>/<marketplace-repository> then /plugin install meta-architect@<marketplace>",
    publish: "Commit this directory to a Git repository, then add it as a Claude Code marketplace.",
  },
  cursor: {
    support: "native",
    description: "Cursor marketplace repository containing native skills and rules.",
    install: "Install the generated marketplace repository through Cursor's plugin flow.",
    publish:
      "Commit this directory to a Git repository and submit or distribute it as a Cursor marketplace.",
  },
  antigravity: {
    support: "native",
    description: "Antigravity plugin directory with native rules and skills.",
    install:
      "Copy this directory into .agents/plugins/ in the workspace or the host plugin directory.",
    publish: "Distribute the generated plugin directory through the Antigravity plugin flow.",
  },
  "gemini-cli": {
    support: "native",
    description: "Gemini CLI extension with a context file and Agent Skills.",
    install: "gemini extensions install <github-url-or-local-path>",
    publish: "Push this directory to GitHub, then install it with gemini extensions install.",
  },
  opencode: {
    support: "native",
    description: "OpenCode project package using its native .opencode/skills surface.",
    install: "Copy .opencode/skills into the OpenCode project.",
    publish: "Distribute this directory through Git or the OpenCode package mechanism.",
  },
  pi: {
    support: "native",
    description: "Pi package surface distributed by the @jstn-sdk/ma package.",
    install:
      "pi install npm:@jstn-sdk/ma@<version> or pi install git:github.com/JustineDevs/meta-architect@v<version>",
    publish: "Publish @jstn-sdk/ma once; no separate Pi package is created.",
  },
  openclaw: {
    support: "portable",
    description:
      "OpenClaw-compatible skills bundle. No runtime plugin is invented for a skills-only source.",
    install: "Copy skills/ into the OpenClaw workspace and load the generated AGENTS.md context.",
    publish:
      "Publish the bundle through the OpenClaw skills or ClawHub flow after adding a real runtime entrypoint.",
  },
  cline: {
    support: "native",
    description: "Cline project rules and native skills bundle.",
    install: "Copy .clinerules and .cline/skills into the Cline project.",
    publish: "Distribute the generated project bundle through Git or the Cline host flow.",
  },
  continue: {
    support: "portable",
    description: "Continue-compatible rules bundle with the portable Agent Skills baseline.",
    install: "Copy .continue/rules and skills into the Continue project.",
    publish: "Distribute the generated bundle through Git or the Continue configuration flow.",
  },
  goose: {
    support: "portable",
    description: "Goose-compatible portable context and skills bundle.",
    install: "Copy AGENTS.md and skills/ into the Goose workspace.",
    publish: "Distribute the generated bundle through Git or the Goose extension flow.",
  },
};

export const supportedPluginTargets = Object.freeze(Object.keys(TARGETS));

function parseArgs(argv) {
  const targets = [];
  let output = path.join(repoRoot, "dist", "vendor-plugins");
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--target" || arg === "--targets") {
      targets.push(...(argv[index + 1] ?? "").split(",").filter(Boolean));
      index += 1;
    } else if (arg === "--output") {
      output = path.resolve(argv[index + 1] ?? output);
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: npm run plugin:build -- --targets all [--output DIR]");
      process.exit(0);
    }
  }
  const selected = targets.length === 0 || targets.includes("all") ? Object.keys(TARGETS) : targets;
  for (const target of selected) {
    if (!Object.hasOwn(TARGETS, target)) throw new Error(`Unknown plugin target: ${target}`);
  }
  return { output, targets: [...new Set(selected)] };
}

async function copyTree(source, destination) {
  const stat = await fs.lstat(source);
  if (stat.isSymbolicLink()) return copyTree(await fs.realpath(source), destination);
  if (stat.isDirectory()) {
    await fs.mkdir(destination, { recursive: true });
    for (const entry of await fs.readdir(source)) {
      await copyTree(path.join(source, entry), path.join(destination, entry));
    }
    return;
  }
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
  await fs.chmod(destination, stat.mode & 0o777);
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeText(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

async function copySkills(destination) {
  await copyTree(skillsRoot, destination);
}

function baselineInstructions(target) {
  return `# Meta-Architect (${target})\n\nUse the bundled Meta-Architect lanes as the canonical workflow contract:\n\n\`$arch\` -> \`$sage\` -> \`$flow\` -> \`$vet\` -> \`$vibe\` -> \`$build\`\n\nRun each lane through this host's native skill or rule loader. Do not claim a gate passed without fresh evidence.\n`;
}

function cursorRule() {
  return `---\ndescription: Meta-Architect gated workflow\nglobs:\n  - "**/*"\nalwaysApply: false\n---\n\nUse the Meta-Architect skills in this plugin in order: $arch, $sage, $flow, $vet, $vibe, then $build. Keep build and release work blocked until the earlier lanes have fresh evidence.\n`;
}

async function buildCodex(output) {
  await copyTree(path.join(sourcePluginRoot, ".codex-plugin"), path.join(output, ".codex-plugin"));
  await copySkills(path.join(output, "skills"));
  for (const file of [".app.json", ".mcp.json", "README.md"]) {
    await copyTree(path.join(sourcePluginRoot, file), path.join(output, file));
  }
}

async function buildClaude(output) {
  const plugin = path.join(output, "plugins", "meta-architect");
  await writeJson(path.join(output, ".claude-plugin", "marketplace.json"), {
    name: "meta-architect",
    owner: { name: "JustineDevs", url: "https://github.com/JustineDevs" },
    metadata: { description: "Meta-Architect gated workflow plugin", version: packageJson.version },
    plugins: [
      {
        name: "meta-architect",
        source: "./plugins/meta-architect",
        description: TARGETS["claude-code"].description,
      },
    ],
  });
  await writeJson(path.join(plugin, ".claude-plugin", "plugin.json"), {
    name: "meta-architect",
    description: "Meta-Architect gated workflow skills for Claude Code.",
    version: packageJson.version,
    author: { name: "JustineDevs", url: "https://github.com/JustineDevs" },
    license: "MIT",
  });
  await copySkills(path.join(plugin, "skills"));
  await writeText(path.join(plugin, "AGENTS.md"), baselineInstructions("Claude Code"));
}

async function buildCursor(output) {
  const plugin = path.join(output, "plugins", "meta-architect");
  await writeJson(path.join(output, ".cursor-plugin", "marketplace.json"), {
    name: "meta-architect",
    owner: { name: "JustineDevs", email: "justinedevs@jstn.site" },
    metadata: { description: "Meta-Architect gated workflow plugin", version: packageJson.version },
    plugins: [
      {
        name: "meta-architect",
        source: "./plugins/meta-architect",
        description: TARGETS.cursor.description,
      },
    ],
  });
  await writeJson(path.join(plugin, ".cursor-plugin", "plugin.json"), {
    name: "meta-architect",
    displayName: "Meta-Architect",
    version: packageJson.version,
    description: "Gated workflow skills for Cursor.",
    author: { name: "JustineDevs", email: "justinedevs@jstn.site" },
    license: "MIT",
    keywords: ["cursor", "plugin", "skills", "workflow"],
  });
  await copySkills(path.join(plugin, "skills"));
  await writeText(path.join(plugin, "rules", "meta-architect.mdc"), cursorRule());
}

async function buildAntigravity(output) {
  await writeJson(path.join(output, "plugin.json"), {
    name: "meta-architect",
    version: packageJson.version,
  });
  await copySkills(path.join(output, "skills"));
  await writeText(
    path.join(output, "rules", "meta-architect.md"),
    baselineInstructions("Antigravity"),
  );
}

async function buildGemini(output) {
  await writeJson(path.join(output, "gemini-extension.json"), {
    name: "meta-architect",
    version: packageJson.version,
    description: "Meta-Architect gated workflow skills for Gemini CLI.",
    contextFileName: "GEMINI.md",
  });
  await writeText(path.join(output, "GEMINI.md"), baselineInstructions("Gemini CLI"));
  await copySkills(path.join(output, "skills"));
}

async function buildOpenCode(output) {
  await copySkills(path.join(output, ".opencode", "skills"));
  await writeText(path.join(output, "AGENTS.md"), baselineInstructions("OpenCode"));
}

async function buildPi(output) {
  await copySkills(path.join(output, "skills"));
}

async function buildOpenClaw(output) {
  await copySkills(path.join(output, "skills"));
  await writeText(path.join(output, "AGENTS.md"), baselineInstructions("OpenClaw"));
}

async function buildCline(output) {
  await writeText(path.join(output, ".clinerules"), baselineInstructions("Cline"));
  await copySkills(path.join(output, ".cline", "skills"));
}

async function buildContinue(output) {
  await copySkills(path.join(output, "skills"));
  await writeText(
    path.join(output, ".continue", "rules", "meta-architect.md"),
    baselineInstructions("Continue"),
  );
}

async function buildGoose(output) {
  await copySkills(path.join(output, "skills"));
  await writeText(path.join(output, "AGENTS.md"), baselineInstructions("Goose"));
}

const builders = {
  codex: buildCodex,
  "claude-code": buildClaude,
  cursor: buildCursor,
  antigravity: buildAntigravity,
  "gemini-cli": buildGemini,
  opencode: buildOpenCode,
  pi: buildPi,
  openclaw: buildOpenClaw,
  cline: buildCline,
  continue: buildContinue,
  goose: buildGoose,
};

async function buildTarget(target, root) {
  const output = path.join(root, target);
  await fs.rm(output, { recursive: true, force: true });
  await builders[target](output);
  await writeJson(path.join(output, "BUILD-MANIFEST.json"), {
    schemaVersion: "1.0",
    name: "meta-architect",
    version: packageJson.version,
    target,
    support: TARGETS[target].support,
    source: "skills/",
    description: TARGETS[target].description,
    install: TARGETS[target].install,
    publish: TARGETS[target].publish,
  });
  return output;
}

export async function buildPlugins({ output, targets }) {
  await fs.mkdir(output, { recursive: true });
  return Promise.all(targets.map((target) => buildTarget(target, output)));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputs = await buildPlugins(args);
  console.log(outputs.join("\n"));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
