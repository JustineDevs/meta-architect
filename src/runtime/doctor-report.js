export function summarizeDoctorStatuses(statuses) {
  if (statuses.some((status) => status.kind === "BLOCKED")) return "BLOCKED";
  if (statuses.some((status) => status.kind === "WARN")) return "READY_WITH_WARNINGS";
  return "READY";
}

export function printDoctorStatuses(title, statuses, write = console.log) {
  write(title);
  write("=".repeat(title.length));
  for (const status of statuses) {
    const label = status.kind.padEnd(7, " ");
    write(`${label} ${status.label}${status.detail ? `: ${status.detail}` : ""}`);
  }
  const result = summarizeDoctorStatuses(statuses);
  write("");
  write(`Result: ${result}`);
  return result;
}
