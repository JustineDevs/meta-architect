export function validateReleaseOrigin(originBranch) {
  return originBranch === "dev";
}

export function rejectsDirectProdPromotion(originBranch) {
  return originBranch !== "dev";
}

export function validateMergeTarget(sourceBranch, targetBranch) {
  return sourceBranch === "dev" && targetBranch === "main";
}

export function canMarkBuildDone(releaseState) {
  return releaseState.build_status === "DONE";
}
