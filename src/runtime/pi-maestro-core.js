export function isPiMaestroEnabled(env = process.env) {
  return env.MA_MAESTRO_PI === "1";
}

export function assertPiMaestroToolAllowed(
  name,
  { controlPlaneReady = true, buildReadiness } = {},
) {
  if (!controlPlaneReady) throw new Error(`${name} blocked by control-plane readiness`);
  if (name === "$build" && buildReadiness && buildReadiness.allowed !== true) {
    throw new Error(
      `$build blocked: ${(buildReadiness.blockers ?? []).join("; ") || "readiness failed"}`,
    );
  }
}

export function createPiMaestroToolSurface({
  runners = {},
  controlPlaneReady = true,
  buildReadiness,
  beforeToolCall,
  afterToolCall,
  isWaitingReview = () => false,
} = {}) {
  const surface = {
    tools: {},
    async dispatch(name, input = {}) {
      if (!runners[name]) throw new Error(`Unknown pi-maestro tool: ${name}`);
      if (isWaitingReview()) return { terminate: true, status: "WAITING_REVIEW" };
      assertPiMaestroToolAllowed(name, { controlPlaneReady, buildReadiness });
      await beforeToolCall?.(name, input);
      const result = await runners[name](input);
      await afterToolCall?.(name, result);
      return { terminate: false, result };
    },
  };
  surface.tools = Object.fromEntries(
    Object.keys(runners).map((name) => [
      name,
      {
        name,
        description: `Run the bounded ${name} Meta-Architect lane`,
        execute: (input) => surface.dispatch(name, input),
      },
    ]),
  );
  return surface;
}

export const maestroGateLanes = ["$arch", "$sage", "$flow", "$vet", "$vibe", "$build"];

export function createPiMaestroCapabilityMapping({
  runners = {},
  enabled = isPiMaestroEnabled(),
  ...options
} = {}) {
  const laneRunners = Object.fromEntries(
    maestroGateLanes
      .filter((lane) => typeof runners[lane] === "function")
      .map((lane) => [lane, runners[lane]]),
  );
  return {
    enabled,
    controlModel: "maestro-pi",
    umbrella: "$maestro",
    lanes: maestroGateLanes.map((id) => ({
      id,
      runner: laneRunners[id] ? "maestro" : "unavailable",
      gated: id === "$build" || id === "$vet",
    })),
    surface: createPiMaestroToolSurface({ runners: laneRunners, ...options }),
  };
}

export async function runPiMaestroExperimental({
  agent,
  tools,
  beforeToolCall,
  afterToolCall,
} = {}) {
  if (!agent || typeof agent.run !== "function") {
    return {
      handled: false,
      reason: "Maestro Pi control runtime is not installed or was not provided",
    };
  }
  const result = await agent.run({ tools, beforeToolCall, afterToolCall });
  return { handled: true, result };
}
