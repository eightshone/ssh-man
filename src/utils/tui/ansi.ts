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
