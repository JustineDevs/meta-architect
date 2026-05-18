export function createStartupCheckpoint(name, startedAt = Date.now()) {
  return {
    name,
    startedAt,
  };
}

export function completeStartupCheckpoint(checkpoint, endedAt = Date.now()) {
  return {
    ...checkpoint,
    endedAt,
    durationMs: endedAt - checkpoint.startedAt,
  };
}
