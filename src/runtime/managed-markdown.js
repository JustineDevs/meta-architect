const START = "<!-- MA:MANAGED:START";
const END = "<!-- MA:MANAGED:END -->";

export function createManagedMarkdownBlock({ id, source, body }) {
  return `${START} id=${id} source=${source} -->\n${body.trim()}\n${END}\n`;
}

export function replaceManagedMarkdownBlock(existing, generated, id) {
  const marker = new RegExp(
    `<!-- MA:MANAGED:START id=${escapeRegExp(id)}[^>]*-->[\\s\\S]*?${END}`,
    "g",
  );
  const starts = existing.match(/<!-- MA:MANAGED:START\b/g)?.length ?? 0;
  const ends = existing.match(new RegExp(escapeRegExp(END), "g"))?.length ?? 0;
  if (starts === 1 && ends === 1 && marker.test(existing))
    return existing.replace(marker, generated.trim());
  return `${existing.trimEnd()}\n\n${generated}`;
}

export function removeManagedMarkdownBlock(existing, id) {
  const marker = new RegExp(
    `\\n?<!-- MA:MANAGED:START id=${escapeRegExp(id)}[^>]*-->[\\s\\S]*?${END}\\n?`,
  );
  return existing.replace(marker, "");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
