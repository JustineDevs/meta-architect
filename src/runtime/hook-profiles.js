export const hookProfiles = {
  local: { scanScope: "active-project", block: true, writeReceipts: true, readOnly: false },
  ci: { scanScope: "active-project", block: true, writeReceipts: true, readOnly: false },
  pr: {
    scanScope: "active-project",
    block: true,
    writeReceipts: true,
    readOnly: false,
    requireFreshness: true,
  },
  audit: { scanScope: "broad", block: false, writeReceipts: false, readOnly: true },
};

export function resolveHookProfile(
  value = process.env.MA_HOOK_PROFILE ?? process.env.MA_PROFILE ?? "local",
) {
  return hookProfiles[value]
    ? { id: value, ...hookProfiles[value] }
    : { id: "local", ...hookProfiles.local };
}
