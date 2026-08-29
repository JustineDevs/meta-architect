const ANSI_ESCAPE_PATTERN = `${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`;
const ANSI_ESCAPE = new RegExp(ANSI_ESCAPE_PATTERN, "g");

export function measureWidth(value) {
  return String(value ?? "").replace(ANSI_ESCAPE, "").length;
}

export function padCell(value, width, align = "left") {
  const text = String(value ?? "");
  const visible = measureWidth(text);
  if (visible === width) return text;
  if (visible > width) return truncateVisible(text, width);
  const padding = " ".repeat(width - visible);
  if (align === "right") return padding + text;
  if (align === "center") {
    const left = Math.floor(padding.length / 2);
    return " ".repeat(left) + text + " ".repeat(padding.length - left);
  }
  return text + padding;
}

function truncateVisible(text, width) {
  const tokens = text.split(new RegExp(`(${ANSI_ESCAPE_PATTERN})`, "g"));
  let output = "";
  let visible = 0;
  for (const token of tokens) {
    if (!token) continue;
    if (token.startsWith(`${String.fromCharCode(27)}[`)) {
      output += token;
      continue;
    }
    const characters = Array.from(token);
    const available = Math.max(0, width - visible);
    output += characters.slice(0, available).join("");
    visible += Math.min(characters.length, available);
    if (characters.length > available) {
      if (
        new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`).test(output) &&
        !output.endsWith(`${String.fromCharCode(27)}[0m`)
      ) {
        output += `${String.fromCharCode(27)}[0m`;
      }
      break;
    }
  }
  return output;
}

export function renderRow(cells, widths, alignments = []) {
  return `| ${cells.map((cell, index) => padCell(cell, widths[index], alignments[index])).join(" | ")} |`;
}

export function renderSeparatorLine(widths) {
  return `+-${widths.map((width) => "-".repeat(width)).join("-+-")}-+`;
}

export function renderGrid(rows, { headers = true, alignments = [] } = {}) {
  if (!rows.length) return "";
  const widths = rows[0].map((_, index) =>
    Math.max(...rows.map((row) => measureWidth(row[index])), 1),
  );
  const lines = [renderSeparatorLine(widths), renderRow(rows[0], widths, alignments)];
  if (headers) lines.push(renderSeparatorLine(widths));
  lines.push(...rows.slice(1).map((row) => renderRow(row, widths, alignments)));
  lines.push(renderSeparatorLine(widths));
  return lines.join("\n");
}
