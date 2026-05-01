import { loadDecisionLog, updateDecisionStatuses } from "./decision-log.js";
import { loadReleaseState, saveReleaseState } from "./release-state.js";

export async function syncStatusUpdates(statusUpdates) {
  const release = await loadReleaseState();
  const nextRelease = { ...release, ...statusUpdates };
  await saveReleaseState(nextRelease);
  await updateDecisionStatuses(statusUpdates);
  return nextRelease;
}

export async function loadCombinedState() {
  const [release, decisions] = await Promise.all([loadReleaseState(), loadDecisionLog()]);
  return { release, decisions };
}
