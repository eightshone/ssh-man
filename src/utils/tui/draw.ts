import { ESC, ansi } from "./ansi";
import { ScreenBuffer } from "./buffer";
import { BOX, SCROLLBAR } from "./components";
import { visibleLength, padOrTruncate } from "./text";
import { getTermSize } from "./term";
import { VERSION } from "../consts";

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

  buf.moveTo(row, col).write(colorize(b.tl + b.h.repeat(inner) + b.tr));

  for (let r = 1; r < h - 1; r++) {
    buf.moveTo(row + r, col).write(colorize(b.v));
    buf.moveTo(row + r, col + w - 1).write(colorize(b.v));
  }

  buf.moveTo(row + h - 1, col).write(colorize(b.bl + b.h.repeat(inner) + b.br));
}

export function fillRegion(
  buf: ScreenBuffer,
  row: number,
  col: number,
  width: number,
  height: number,
  char: string = " ",
): void {
  for (let r = 0; r < height; r++) {
    buf.moveTo(row + r, col).write(char.repeat(width));
  }
}

export function drawPopup(
  buf: ScreenBuffer,
  title: string,
  content: string[],
  choices: string[] = [],
  selectedIndex: number = 0,
  colorCode: string = "255",
  onlyChoices: boolean = false,
  customWidth?: number,
): void {
  const { rows, cols } = getTermSize();
  const width = customWidth || Math.min(cols - 4, 50);
  const height = content.length + choices.length + 4;
  const startRow = Math.floor((rows - height) / 2);
  const startCol = Math.floor((cols - width) / 2);

  if (!onlyChoices) {
    fillRegion(buf, startRow, startCol, width, height, " ");
    drawBox(buf, startRow, startCol, width, height, "rounded", colorCode);
    const centeredTitle = ` ${title} `;
    writeTextCentered(buf, startRow, startCol, width, centeredTitle, colorCode);
    content.forEach((line, i) => {
      const text = padOrTruncate(line, width - 4);
      buf.moveTo(startRow + 1 + i, startCol + 2).write(text);
    });
  }

  choices.forEach((choice, i) => {
    const isSelected = i === selectedIndex;
    const choiceText = ` ${choice}`;
    const row = startRow + content.length + 2 + i;

    buf.moveTo(row, startCol + 2);
    if (isSelected) {
      buf.write(ansi.bg(238, padOrTruncate(choiceText, width - 4)));
    } else {
      buf.write(padOrTruncate(choiceText, width - 4));
    }
  });
}

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

export function writeText(
  buf: ScreenBuffer,
  row: number,
  col: number,
  text: string,
): void {
  buf.moveTo(row, col).write(text);
}

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

export interface Keybinding {
  key: string;
  action: string;
}

export function drawFooter(
  buf: ScreenBuffer,
  cols: number,
  rows: number,
  keybindings: Keybinding[],
  offset: number = 0,
): void {
  const verStr = ` v${VERSION}`;
  const vVerLen = visibleLength(verStr);
  const cycleHint = " | cycle: <shift-tab>";
  const vCycleHintLen = visibleLength(cycleHint);

  let availableForMsg = Math.max(0, cols - vVerLen - 2);

  let allFit = true;
  let totalLen = 0;
  for (let i = 0; i < keybindings.length; i++) {
    const kb = keybindings[i];
    const kbStr = `${kb.action}: ${kb.key}`;
    totalLen += visibleLength(kbStr) + (i > 0 ? 3 : 0);
  }

  let formattedMsg = "";

  if (totalLen <= availableForMsg || keybindings.length === 0) {
    formattedMsg = keybindings.map(kb => `${kb.action}: ${kb.key}`).join(" | ");
  } else {
    let availWithHint = availableForMsg - vCycleHintLen;
    const startIndex = offset % keybindings.length;
    let currentLen = 0;
    const toRender: string[] = [];

    for (let i = 0; i < keybindings.length; i++) {
      const idx = (startIndex + i) % keybindings.length;
      const kb = keybindings[idx];
      const kbStr = `${kb.action}: ${kb.key}`;
      const kbLen = visibleLength(kbStr) + (toRender.length > 0 ? 3 : 0);

      if (currentLen + kbLen <= availWithHint) {
        toRender.push(kbStr);
        currentLen += kbLen;
      } else {
        break;
      }
    }

    if (toRender.length === 0) {
      toRender.push(`${keybindings[startIndex].action}: ${keybindings[startIndex].key}`);
    }

    formattedMsg = toRender.join(" | ") + cycleHint;
  }

  const displayMsg = padOrTruncate(formattedMsg, availableForMsg);

  buf.moveTo(rows, 2).write(ansi.fg("250", displayMsg) + ansi.dim(verStr));
}

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
