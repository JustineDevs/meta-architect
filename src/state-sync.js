import { loadDecisionLog } from "./decision-log.js";
import { writeJson } from "./fs-utils.js";
import { getRuntimeWritePath } from "./paths.js";
import { allowedStatuses, loadReleaseStateOrDefault, saveReleaseState } from "./release-state.js";
import { loadManagerRunRegistryOrDefault } from "./runtime/maestro-manager.js";
import { guardLeaderMutation } from "./runtime/runtime-state.js";

const publicStatusFields = new Set(Object.keys(allowedStatuses));

function validatePublicStatusUpdates(statusUpdates) {
  if (!statusUpdates || typeof statusUpdates !== "object" || Array.isArray(statusUpdates)) {
    throw new Error("Status updates must be an object");
  }

  const invalidFields = Object.keys(statusUpdates).filter(
    (field) => !publicStatusFields.has(field),
  );
  if (invalidFields.length > 0) {
    throw new Error(`Unknown release status field(s): ${invalidFields.join(", ")}`);
  }
}

export async function syncStatusUpdates(statusUpdates, options = {}) {
  validatePublicStatusUpdates(statusUpdates);
  const guard = await guardLeaderMutation({
    actor: options.actor,
    kind: "release-status-update",
    payload: statusUpdates,
  });
  if (!guard.allowed) {
    return { proposed: true, proposalPath: guard.proposalPath };
  }

  const [release, decisions] = await Promise.all([loadReleaseStateOrDefault(), loadDecisionLog()]);
  const nextRelease = { ...release, ...statusUpdates };
  await saveReleaseState(nextRelease);

  try {
    for (const [field, value] of Object.entries(statusUpdates)) {
      decisions[field] = value;
    }
    await writeJson(getRuntimeWritePath("decisions.json"), decisions);
  } catch (error) {
    await saveReleaseState(release);
    throw error;
  }

  return { proposed: false, proposalPath: null, release: nextRelease };
}

export async function loadCombinedState() {
  const [release, decisions, managerRuns] = await Promise.all([
    loadReleaseStateOrDefault(),
    loadDecisionLog(),
    loadManagerRunRegistryOrDefault(),
  ]);
  return { release, decisions, managerRuns };
}
