export function createMaestroView(maestroState) {
  const tracks = Object.entries(maestroState?.runtime_tracks ?? {}).map(([id, track]) => ({
    id,
    gate: track.active_gate ?? "none",
    status: track.status ?? "unknown",
    blockers: Array.isArray(track.blockers) ? track.blockers : [],
  }));
  const locks = Object.entries(maestroState?.downstream_lock_table ?? {}).map(([gate, lock]) => ({
    gate,
    status: lock.is_locked ? "locked" : "unlocked",
    lockedBy: Array.isArray(lock.locked_by) ? lock.locked_by : [],
    unlockCriteria: lock.unlock_criteria ?? null,
  }));
  const blockers = tracks.flatMap((track) =>
    track.blockers.map((message) => `${track.id}: ${message}`),
  );
  return {
    schemaVersion: "0.1.0",
    scope: "maestro",
    globalStatus: maestroState?.global_status ?? "unknown",
    orchestrationId: maestroState?.orchestration_id ?? null,
    tracks,
    locks,
    blockers,
    nextAction:
      blockers[0] ??
      (locks.some((lock) => lock.status === "locked")
        ? "Resolve downstream locks"
        : "Continue active lane"),
  };
}

export function formatMaestroView(view) {
  const lines = [
    "Maestro View",
    "Meta-Architect / Maestro",
    "========================",
    `Global status: ${view.globalStatus}`,
    `Orchestration id: ${view.orchestrationId ?? "not started"}`,
    `Status: ${view.globalStatus}`,
    `Run: ${view.orchestrationId ?? "not started"}`,
    "",
    "Lane        Gate                  Status",
    "----------  --------------------  ----------",
  ];
  if (view.tracks.length === 0) lines.push("none");
  for (const track of view.tracks)
    lines.push(`${track.id.padEnd(10)}  ${track.gate.padEnd(20)}  ${track.status}`);
  lines.push("", "Blockers");
  lines.push(...(view.blockers.length ? view.blockers.map((item) => `- ${item}`) : ["- none"]));
  lines.push("", `Next: ${view.nextAction}`, "", "Downstream locks");
  lines.push(
    ...(view.locks.length
      ? view.locks.map((lock) => `- ${lock.gate}: ${lock.status}`)
      : ["- none"]),
  );
  return `${lines.join("\n")}\n`;
}
