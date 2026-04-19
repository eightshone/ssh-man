import { ESC } from "./ansi";

export function highlightTerms(
  text: string,
  terms: string[],
  baseStyle: string = "",
): string {
  if (!terms || terms.length === 0 || !text) return text;

  const ranges: [number, number][] = [];
  const lowerText = text.toLowerCase();

  for (const term of terms) {
    if (!term) continue;
    const lowerTerm = term.toLowerCase();
    let pos = 0;
    while ((pos = lowerText.indexOf(lowerTerm, pos)) !== -1) {
      ranges.push([pos, pos + lowerTerm.length]);
      pos += 1;
    }
  }

  if (ranges.length === 0) return text;

  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: [number, number][] = [];
  let current = ranges[0];
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i][0] <= current[1]) {
      current[1] = Math.max(current[1], ranges[i][1]);
    } else {
      merged.push(current);
      current = ranges[i];
    }
  }
  merged.push(current);

  let result = "";
  let lastPos = 0;
  const highlightPrefix = `${ESC}48;5;240m`;
  const highlightSuffix = `${ESC}0m${baseStyle}`;

  for (const [start, end] of merged) {
    result += text.slice(lastPos, start);
    result += highlightPrefix + text.slice(start, end) + highlightSuffix;
    lastPos = end;
  }
  result += text.slice(lastPos);

  return result;
}

export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

export function visibleLength(str: string): number {
  return stripAnsi(str).length;
}

export function padOrTruncate(str: string, len: number): string {
  const vLen = visibleLength(str);
  if (vLen > len) {
    return stripAnsi(str).slice(0, len - 1) + "…";
  }
  return str + " ".repeat(len - vLen);
}
