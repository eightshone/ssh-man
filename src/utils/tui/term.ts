export interface TermSize {
  rows: number;
  cols: number;
}

export function getTermSize(): TermSize {
  return {
    rows: process.stdout.rows || 24,
    cols: process.stdout.columns || 80,
  };
}
