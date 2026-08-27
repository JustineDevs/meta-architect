export const contextAuthorityOrder = [
  "source_truth",
  "verified_evidence",
  "hook_evidence",
  "generated_context",
  "vault_note",
  "learning_memory",
  "external_reference",
  "stale",
];

export function createFreshness({
  sourceHash = null,
  sourceFiles = [],
  checkedAt = new Date().toISOString(),
  status = "fresh",
} = {}) {
  return {
    status,
    stale: status === "stale",
    checkedAt,
    sourceHash,
    sourceFiles: [...sourceFiles],
    changedFiles: [...sourceFiles],
  };
}

export function resolveContextConflict(candidates = []) {
  return (
    [...candidates]
      .filter((candidate) => candidate && typeof candidate === "object")
      .sort((left, right) => {
        const authority =
          contextAuthorityOrder.indexOf(left.authority) -
          contextAuthorityOrder.indexOf(right.authority);
        if (authority !== 0) return authority;
        return Number(Boolean(left.freshness?.stale)) - Number(Boolean(right.freshness?.stale));
      })[0] ?? null
  );
}
