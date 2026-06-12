import { menu, server } from "../../utils/types";
import { setupInput } from "../../utils/tui/input";
import {
  ESC,
  ansi,
  ScreenBuffer,
  drawBox,
  writeTextCentered,
  writeText,
  padOrTruncate,
  getTermSize,
  visibleLength,
  drawFooter,
} from "../../utils/tui/index";

type MenuItem = {
  name: string;
  value: menu | null;
  selectable: boolean;
  options?: string[];
  muted?: boolean;
};

const ASCII_ART_LARGE = [
  " ┌███████┌███████┌██  ┌██┌███   ┌███ ┌█████ ┌███   ┌██",
  " │██────┘│██────┘│██  │██│████ ┌████┌██──┐██│████  │██",
  " │███████│███████│███████│██┐████┐██│███████│██┐██ │██",
  " └────┐██└────┐██│██──┐██│██└┐██┘│██│██──┐██│██└┐██│██",
  " ┌███████┌███████│██  │██│██ └─┘ │██│██  │██│██ └┐████",
  " └──────┘└──────┘└─┘  └─┘└─┘     └─┘└─┘  └─┘└─┘  └───┘",
];

const ASCII_ART_MEDIUM = [
  "░█▀▀░█▀▀░█░█░█▄█░█▀█░█▀█",
  "░▀▀█░▀▀█░█▀█░█░█░█▀█░█░█",
  "░▀▀▀░▀▀▀░▀░▀░▀░▀░▀░▀░▀░▀",
];

const ASCII_ART_SMALL = ["SSHMAN"];

const MATRIX_CHARS =
  "ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789";

type MatrixDrop = {
  head: number;
  tailLen: number;
  chars: string[];
  delay: number;
  speed: number;
  ticker: number;
};

function randomMatrixChar(): string {
  return MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
}

function stepDrops(drops: MatrixDrop[], innerRows: number): void {
  for (const drop of drops) {
    if (drop.delay > 0) {
      drop.delay--;
      continue;
    }

    drop.ticker++;
    if (drop.ticker >= drop.speed) {
      drop.ticker = 0;
      drop.head++;

      if (drop.head >= 0 && drop.head < innerRows) {
        drop.chars[drop.head] = randomMatrixChar();
      }

      if (drop.head - drop.tailLen >= innerRows) {
        drop.head = -1;
        drop.delay = 5 + Math.floor(Math.random() * 30);
        drop.tailLen = 5 + Math.floor(Math.random() * 14);
      }
    }
  }
}

let selectedIndex = -1;
let listOffset = 0;
let footerOffset = 0;

export default function mainMenu(
  recentServers: server[] = [],
): Promise<[menu, string[] | null]> {
  return new Promise((resolve) => {
    let items: MenuItem[] = [
      {
        name: "Recent connections",
        value: null,
        selectable: false,
        muted: true,
      },
    ];

    if (recentServers.length > 0) {
      recentServers.slice(0, 3).forEach((srv, idx) => {
        items.push({
          name: `${idx + 1} - ${srv.name}`,
          value: "ssh-connect" as menu,
          selectable: true,
          options: [JSON.stringify(srv)],
        });
      });
    } else {
      items.push({
        name: "  No recent sessions! Add or connect to one to see it here",
        value: null,
        selectable: false,
        muted: true,
      });
    }

    items.push({ name: "", value: null, selectable: false });
    items.push({
      name: "New connection",
      value: "ssh-new",
      selectable: true,
    });
    items.push({
      name: "Saved connections",
      value: "ssh-list",
      selectable: true,
    });
    items.push({
      name: "Logs",
      value: "logs",
      selectable: true,
    });
    items.push({ name: "", value: null, selectable: false });
    items.push({ name: "Settings", value: "settings", selectable: true });
    items.push({ name: "Manual", value: "manual", selectable: true });
    items.push({ name: "Quit", value: "exit", selectable: true });

    if (
      selectedIndex === -1 ||
      selectedIndex >= items.length ||
      !items[selectedIndex].selectable
    ) {
      let firstSelectable = items.findIndex((i) => i.selectable);
      selectedIndex = firstSelectable === -1 ? 0 : firstSelectable;
    }

    // ── Screensaver state ──────────────────────────────────────────────────
    let screensaverActive = false;
    let screensaverInterval: ReturnType<typeof setInterval> | null = null;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let drops: MatrixDrop[] = [];
    let dropRows = 0;
    let dropCols = 0;

    const makeDrops = (innerCols: number, innerRows: number): MatrixDrop[] =>
      Array.from({ length: Math.max(innerCols, 0) }, () => ({
        head: -1,
        tailLen: 5 + Math.floor(Math.random() * 14),
        chars: Array.from({ length: Math.max(innerRows, 1) }, () =>
          randomMatrixChar(),
        ),
        delay: Math.floor(Math.random() * 25),
        speed: 1 + Math.floor(Math.random() * 2),
        ticker: 0,
      }));

    const renderScreensaver = () => {
      const { rows, cols } = getTermSize();
      const innerRows = rows - 3;
      const innerCols = cols - 2;

      if (innerRows !== dropRows || innerCols !== dropCols) {
        dropRows = innerRows;
        dropCols = innerCols;
        drops = makeDrops(innerCols, innerRows);
        const buf = new ScreenBuffer();
        buf.write(ansi.clear());
        if (innerRows > 0) drawBox(buf, 1, 1, cols, rows - 1, "rounded");
        buf.write(ansi.hideCursor());
        buf.flush();
        return;
      }

      if (innerRows <= 0 || innerCols <= 0) return;

      stepDrops(drops, innerRows);

      const buf = new ScreenBuffer();

      for (let r = 0; r < innerRows; r++) {
        buf.moveTo(2 + r, 2);
        let rowStr = "";

        for (let c = 0; c < innerCols; c++) {
          const drop = drops[c];

          if (drop.delay > 0 || drop.head < 0) {
            rowStr += " ";
            continue;
          }

          const dist = drop.head - r;

          if (dist === 0) {
            rowStr += `${ESC}38;5;255m${drop.chars[r]}${ESC}0m`;
          } else if (dist > 0 && dist <= drop.tailLen) {
            const ratio = 1 - dist / drop.tailLen;
            const color =
              ratio > 0.75 ? 82 : ratio > 0.5 ? 46 : ratio > 0.25 ? 34 : 22;
            rowStr += `${ESC}38;5;${color}m${drop.chars[r]}${ESC}0m`;
          } else {
            rowStr += " ";
          }
        }

        buf.write(rowStr);
      }

      buf.write(ansi.hideCursor());
      buf.flush();
    };

    const startScreensaver = () => {
      screensaverActive = true;
      const { rows, cols } = getTermSize();
      const innerRows = rows - 3;
      const innerCols = cols - 2;
      dropRows = innerRows;
      dropCols = innerCols;
      drops = makeDrops(innerCols, innerRows);

      const buf = new ScreenBuffer();
      buf.write(ansi.clear());
      if (innerRows > 0) drawBox(buf, 1, 1, cols, rows - 1, "rounded");
      buf.write(ansi.hideCursor());
      buf.flush();

      screensaverInterval = setInterval(renderScreensaver, 80);
    };

    const stopScreensaver = () => {
      if (screensaverInterval !== null) {
        clearInterval(screensaverInterval);
        screensaverInterval = null;
      }
      screensaverActive = false;
    };

    const resetIdleTimer = () => {
      if (idleTimer !== null) clearTimeout(idleTimer);
      idleTimer = setTimeout(startScreensaver, 15_000);
    };
    // ── End screensaver ────────────────────────────────────────────────────

    const render = (fullRender: boolean = false) => {
      const { rows, cols } = getTermSize();
      const buf = new ScreenBuffer();

      const availableInnerRows = rows - 3;

      let activeArt = ASCII_ART_LARGE;
      if (availableInnerRows < activeArt.length + 1 + items.length)
        activeArt = ASCII_ART_MEDIUM;
      if (availableInnerRows < activeArt.length + 1 + items.length)
        activeArt = ASCII_ART_SMALL;

      const totalRequiredRows = activeArt.length + 1 + items.length;
      let listHeight = items.length;

      if (availableInnerRows < totalRequiredRows) {
        listHeight = Math.max(0, availableInnerRows - (activeArt.length + 1));
      }

      let startRow = 2;
      if (availableInnerRows > totalRequiredRows) {
        startRow = 2 + Math.floor((availableInnerRows - totalRequiredRows) / 2);
      }

      let currentLine = startRow;

      // Adjust scroll offset
      if (selectedIndex < listOffset) listOffset = selectedIndex;
      if (selectedIndex >= listOffset + listHeight && listHeight > 0) {
        listOffset = selectedIndex - listHeight + 1;
      }
      if (listHeight >= items.length) listOffset = 0;

      // Optional clear and static borders on init or resize
      if (fullRender) {
        buf.write(ansi.clear());
        drawBox(buf, 1, 1, cols, rows - 1, "rounded");

        if (listHeight > 0) {
          for (const line of activeArt) {
            writeTextCentered(buf, currentLine++, 1, cols - 2, line);
          }
        }
      } else {
        if (listHeight > 0) {
          currentLine += activeArt.length;
        }
      }

      // Dynamic Footer
      const selectedItem = items[selectedIndex];
      let actionHint = "Select";
      if (selectedItem?.value === "ssh-connect") actionHint = "Connect";
      else if (selectedItem?.value === "exit") actionHint = "Quit";

      const keybindings = [
        { action: "Navigate", key: "↑ ↓" },
        { action: actionHint, key: "<enter>" },
        { action: "Quit", key: "<q> or <ctrl-c>" },
      ];

      drawFooter(buf, cols, rows, keybindings, footerOffset);

      if (listHeight > 0) {
        currentLine += 1;
      }

      // Draw Menu items
      const maxListWidth = Math.min(70, cols - 4);
      const listColStart = Math.max(3, Math.floor((cols - maxListWidth) / 2));

      if (listHeight <= 0) {
        const msg = "Terminal too small";
        writeTextCentered(buf, Math.floor(rows / 2), 1, cols - 2, msg, "196");
      } else {
        for (let i = 0; i < listHeight; i++) {
          const itemIdx = listOffset + i;

          if (itemIdx >= items.length) {
            const blankSpace = " ".repeat(maxListWidth);
            buf.moveTo(currentLine + i, listColStart).write(blankSpace);
            continue;
          }

          const item = items[itemIdx];
          let rowIdx = currentLine + i;

          let text = padOrTruncate(item.name, maxListWidth);

          if (itemIdx === selectedIndex && item.selectable) {
            buf
              .moveTo(rowIdx, listColStart)
              .write(`${ansi.bg(238, ansi.fg(255, text))}`);
          } else if (item.muted) {
            buf.moveTo(rowIdx, listColStart).write(ansi.dim(text));
          } else {
            buf.moveTo(rowIdx, listColStart).write(text);
          }
        }
      }

      // Hide cursor and commit
      buf.write(ansi.hideCursor());
      buf.flush();
    };

    const cleanupScreen = () => {
      if (idleTimer !== null) clearTimeout(idleTimer);
      if (screensaverInterval !== null) clearInterval(screensaverInterval);
      process.stdout.removeListener("resize", resizeHandler);
      cleanup();
      process.stdout.write(
        ansi.showCursor() + ansi.clear() + ansi.moveTo(1, 1),
      );
    };

    const { stdin, cleanup } = setupInput((key, char) => {
      if (screensaverActive) {
        stopScreensaver();
        resetIdleTimer();
        render(true);
        return;
      }

      resetIdleTimer();

      if (key === "ctrl-c" || (key === "char" && char?.toLowerCase() === "q")) {
        cleanupScreen();
        resolve(["exit", null]);
        return;
      }

      if (key === "shift-tab") {
        footerOffset++;
        render();
        return;
      }

      if (key === "up") {
        do {
          selectedIndex--;
          if (selectedIndex < 0) selectedIndex = items.length - 1;
        } while (!items[selectedIndex].selectable);
        render();
        return;
      }

      if (key === "down") {
        do {
          selectedIndex++;
          if (selectedIndex >= items.length) selectedIndex = 0;
        } while (!items[selectedIndex].selectable);
        render();
        return;
      }

      if (key === "enter") {
        const selectedItem = items[selectedIndex];
        if (selectedItem.selectable && selectedItem.value !== null) {
          cleanupScreen();
          resolve([selectedItem.value, selectedItem.options || null]);
        }
        return;
      }
    });

    const resizeHandler = () => {
      if (screensaverActive) {
        const { rows, cols } = getTermSize();
        const buf = new ScreenBuffer();
        buf.write(ansi.clear());
        drawBox(buf, 1, 1, cols, rows - 1, "rounded");
        buf.write(ansi.hideCursor());
        buf.flush();
        dropRows = 0; // force drop reinit on next tick
      } else {
        render(true);
      }
    };

    process.stdout.on("resize", resizeHandler);
    render(true);
    resetIdleTimer();
  });
}
