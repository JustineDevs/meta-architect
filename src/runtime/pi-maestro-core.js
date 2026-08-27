export function isPiMaestroEnabled(env = process.env) {
  return env.MA_PI_AGENT_CORE === "1";
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
  beforeToolCall,
  afterToolCall,
  isWaitingReview = () => false,
} = {}) {
  return {
    tools: Object.fromEntries(
      Object.entries(runners).map(([name, runner]) => [
        name,
        { name, description: `Run the bounded ${name} Meta-Architect lane`, execute: runner },
      ]),
    ),
    async dispatch(name, input = {}) {
      if (!runners[name]) throw new Error(`Unknown pi-maestro tool: ${name}`);
      if (isWaitingReview()) return { terminate: true, status: "WAITING_REVIEW" };
      await beforeToolCall?.(name, input);
      const result = await runners[name](input);
      await afterToolCall?.(name, result);
      return { terminate: false, result };
    },
  };
}

export async function runPiMaestroExperimental({
  agent,
  tools,
  beforeToolCall,
  afterToolCall,
} = {}) {
  if (!agent || typeof agent.run !== "function") {
    return { handled: false, reason: "pi-agent-core is not installed or was not provided" };
  }
  const result = await agent.run({ tools, beforeToolCall, afterToolCall });
  return { handled: true, result };
}
