import readline from "readline";

function batchPrint(lines: string[]): void {
  const terminalHeight: number = process.stdout.rows || 24; // Default to 24 if undefined
  const batchSize: number = terminalHeight - 3;
  let currentIndex: number = 0;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let promptDisplayed: boolean = false;

  function printBatch(): void {
    if (promptDisplayed) {
      readline.cursorTo(process.stdout, 0);
      readline.moveCursor(process.stdout, 0, -2);
      readline.clearScreenDown(process.stdout);
    }

    const end: number = Math.min(currentIndex + batchSize, lines.length);
    for (let i = currentIndex; i < end; i++) {
      console.log(lines[i]);
    }
    currentIndex = end;

    if (currentIndex >= lines.length) {
      rl.close();
      return;
    }

    console.log("\nPress <space> for next batch or 'q' to quit.");
    promptDisplayed = true;
  }

  // @ts-ignore
  rl.input.on("keypress", (char: string, key: readline.Key) => {
    if (key && key.name === "q") {
      rl.close();
    } else if (key && key.name === "space") {
      printBatch();
    }
  });

  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);

  printBatch();

  rl.on("close", () => {
    process.stdin.setRawMode(false);
  });
}

export default batchPrint;
