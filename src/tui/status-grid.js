import { renderGrid } from "./grid.js";

export function renderCheckGrid(statuses) {
  return renderGrid([
    ["Status", "Check", "Detail"],
    ...statuses.map(({ kind, label, detail = "" }) => [kind, label, detail]),
  ]);
}

export function renderReleaseGrid(release, nextTriggers = []) {
  const rows = [
    ["Gate", "Status"],
    ["Idea", release.idea_status],
    ["Architecture", release.architecture_status],
    ["Evidence", release.evidence_status],
    ["Logic", release.logic_status],
    ["Security", release.security_status],
    ["Experience", release.experience_status],
    ["Build", release.build_status],
  ];
  if (nextTriggers.length) rows.push(["Next", nextTriggers.join(", ")]);
  return renderGrid(rows);
}
