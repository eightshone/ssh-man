/**
 * tui/index.ts — Low-level TUI drawing helpers.
 *
 * Every visual primitive the app needs is built here on top of
 * process.stdout.write and ANSI escape codes.  No third-party deps.
 */

import { VERSION } from "../consts";

// ─── ANSI helpers ───────────────────────────────────────────────────────────

export const ESC = "\x1b[";

export const ansi = {
  clear: () => `${ESC}2J`,
  moveTo: (r: number, c: number) => `${ESC}${r};${c}H`,
  hideCursor: () => `${ESC}?25l`,
  showCursor: () => `${ESC}?25h`,
  altScreenEnter: () => `${ESC}?1049h`,
  altScreenExit: () => `${ESC}?1049l`,
  bold: (s: string) => `${ESC}1m${s}${ESC}0m`,
  dim: (s: string) => `${ESC}2m${s}${ESC}0m`,
  inverse: (s: string) => `${ESC}7m${s}${ESC}0m`,
  fg: (code: number | string, s: string) => `${ESC}38;5;${code}m${s}${ESC}0m`,
  bg: (code: number | string, s: string) => `${ESC}48;5;${code}m${s}${ESC}0m`,
  fgRgb: (r: number, g: number, b: number, s: string) =>
    `${ESC}38;2;${r};${g};${b}m${s}${ESC}0m`,
  bgRgb: (r: number, g: number, b: number, s: string) =>
    `${ESC}48;2;${r};${g};${b}m${s}${ESC}0m`,
  reset: () => `${ESC}0m`,
};

// ─── Box-drawing characters ─────────────────────────────────────────────────

export const BOX: Record<
  string,
  { tl: string; tr: string; bl: string; br: string; h: string; v: string }
> = {
  single: {
    tl: "┌",
    tr: "┐",
    bl: "└",
    br: "┘",
    h: "─",
    v: "│",
  },
  double: {
    tl: "╔",
    tr: "╗",
    bl: "╚",
    br: "╝",
    h: "═",
    v: "║",
  },
  rounded: {
    tl: "╭",
    tr: "╮",
    bl: "╰",
    br: "╯",
    h: "─",
    v: "│",
  },
};

// Scrollbar characters
export const SCROLLBAR = {
  track: "│",
  thumb: "┃",
};

// ─── Utility: strip ANSI codes for accurate width calculation ────────────────

export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

export function visibleLength(str: string): number {
  return stripAnsi(str).length;
}

// ─── Screen buffer ──────────────────────────────────────────────────────────

/**
 * A virtual screen buffer that collects all writes,
 * then flushes them in one shot to avoid flicker.
 */
export class ScreenBuffer {
  chunks: string[];

  constructor() {
    this.chunks = [];
  }

  write(str: string): this {
    this.chunks.push(str);
    return this;
  }

  moveTo(row: number, col: number): this {
    this.chunks.push(ansi.moveTo(row, col));
    return this;
  }

  flush(): void {
    process.stdout.write(this.chunks.join(""));
    this.chunks = [];
  }
}

// ─── Drawing functions ──────────────────────────────────────────────────────

/**
 * Draw a bordered box at (row, col) with given width and height.
 */
export function drawBox(
  buf: ScreenBuffer,
  row: number,
  col: number,
  w: number,
  h: number,
  style: string = "single",
  color: string | null = null,
): void {
  const b = BOX[style] || BOX.single;
  const inner = w - 2;

  const colorize = (s: string) => {
    if (color) return `${ESC}38;5;${color}m${s}${ESC}0m`;
    return s;
  };

  // Top border
  buf.moveTo(row, col).write(colorize(b.tl + b.h.repeat(inner) + b.tr));

  // Side borders
  for (let r = 1; r < h - 1; r++) {
    buf.moveTo(row + r, col).write(colorize(b.v));
    buf.moveTo(row + r, col + w - 1).write(colorize(b.v));
  }

  // Bottom border
  buf.moveTo(row + h - 1, col).write(colorize(b.bl + b.h.repeat(inner) + b.br));
}

/**
 * Write text inside a box, horizontally centered.
 */
export function writeTextCentered(
  buf: ScreenBuffer,
  row: number,
  col: number,
  width: number,
  text: string,
  colorCode: string | null = null,
): void {
  const vLen = visibleLength(text);
  const pad = Math.max(0, Math.floor((width - vLen) / 2));
  buf.moveTo(row, col + pad);
  if (colorCode) {
    buf.write(`${ESC}38;5;${colorCode}m${text}${ESC}0m`);
  } else {
    buf.write(text);
  }
}

/**
 * Write text left-aligned at a position.
 */
export function writeText(
  buf: ScreenBuffer,
  row: number,
  col: number,
  text: string,
): void {
  buf.moveTo(row, col).write(text);
}

/**
 * Write text that fills an entire row width, padding with spaces.
 */
export function writeFullRow(
  buf: ScreenBuffer,
  row: number,
  col: number,
  width: number,
  text: string,
): void {
  const vLen = visibleLength(text);
  const padding = Math.max(0, width - vLen);
  buf.moveTo(row, col).write(text + " ".repeat(padding));
}

/**
 * Draw the standard footer incorporating navigation hints and the version block.
 */
export function drawFooter(
  buf: ScreenBuffer,
  cols: number,
  rows: number,
  message: string,
): void {
  buf.moveTo(rows, 2).write(ansi.fg("250", message));
  const verStr = ` v${VERSION}`;
  buf.moveTo(rows, cols - verStr.length).write(ansi.dim(verStr));
}

/**
 * Draw a vertical scrollbar.
 */
export function drawScrollbar(
  buf: ScreenBuffer,
  col: number,
  topRow: number,
  height: number,
  total: number,
  visible: number,
  offset: number,
  color: string = "240",
): void {
  if (total <= visible) {
    // No scrollbar needed — fill track with track character
    for (let i = 0; i < height; i++) {
      buf.moveTo(topRow + i, col).write(SCROLLBAR.track);
    }
    return;
  }

  const thumbSize = Math.max(1, Math.round((visible / total) * height));
  const maxOffset = total - visible;
  const thumbPos = Math.round((offset / maxOffset) * (height - thumbSize));

  for (let i = 0; i < height; i++) {
    buf.moveTo(topRow + i, col);
    if (i >= thumbPos && i < thumbPos + thumbSize) {
      buf.write(`${ESC}38;5;${color}m${SCROLLBAR.thumb}${ESC}0m`);
    } else {
      buf.write(`${ESC}38;5;${color}m${SCROLLBAR.track}${ESC}0m`);
    }
  }
}

/**
 * Pad or truncate a string to exactly `len` visible characters.
 */
export function padOrTruncate(str: string, len: number): string {
  const vLen = visibleLength(str);
  if (vLen > len) {
    // Truncate (works for non-ANSI strings; for ANSI we do a rough cut)
    return stripAnsi(str).slice(0, len - 1) + "…";
  }
  return str + " ".repeat(len - vLen);
}

export interface TermSize {
  rows: number;
  cols: number;
}

/**
 * Get terminal dimensions.
 */
export function getTermSize(): TermSize {
  return {
    rows: process.stdout.rows || 24,
    cols: process.stdout.columns || 80,
  };
}
