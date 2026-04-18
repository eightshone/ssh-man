import { ansi } from "./ansi";

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
