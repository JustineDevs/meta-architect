export function validateReleaseOrigin(originBranch) {
  if (originBranch === "development") {
    return true;
  }

  if (originBranch.startsWith("release/")) {
    return true;
  }

  return false;
}

export function rejectsDirectProdPromotion(originBranch) {
  return originBranch.startsWith("feature/");
}

export function validateMergeTarget(sourceBranch, targetBranch) {
  return sourceBranch.startsWith("feature/") && targetBranch === "development";
}

export function canMarkBuildDone(releaseState) {
  return releaseState.build_status === "DONE";
}
