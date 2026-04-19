import colors from "yoctocolors-cjs";
import { log, menu } from "../../utils/types";
import { setupInput } from "../../utils/tui/input";
import {
  ansi,
  ScreenBuffer,
  drawBox,
  writeFullRow,
  padOrTruncate,
  getTermSize,
  drawScrollbar,
  drawFooter,
  highlightTerms,
  ESC,
} from "../../utils/tui/index";

let searchInput = "";
let cursorPos = 0;
let selectedIndex = 0;
let listOffset = 0;
let footerOffset = 0;

export default function interactiveLogs(logs: log[] = []): Promise<[menu]> {
  return new Promise((resolve) => {
    const getFiltered = () => {
      const q = searchInput.toLowerCase().trim();
      if (!q) return logs.map((lg, idx) => ({ ...lg, originalIndex: idx }));

      const words = q.split(/\s+/).filter((w) => w.length > 0);

      return logs
        .map((lg, idx) => ({ ...lg, originalIndex: idx }))
        .filter((lg) => {
          return words.some((word) => {
            return (
              (lg.serverName?.toLowerCase().includes(word) ?? false) ||
              (lg.time?.toLowerCase().includes(word) ?? false) ||
              (lg.server?.toLowerCase().includes(word) ?? false)
            );
          });
        });
    };

    let filtered = getFiltered();

    const render = (fullRender: boolean = false) => {
      const { rows, cols } = getTermSize();
      const buf = new ScreenBuffer();

      // Ensure index is valid
      if (filtered.length === 0) {
        selectedIndex = 0;
        listOffset = 0;
      } else {
        if (selectedIndex >= filtered.length)
          selectedIndex = filtered.length - 1;
        if (selectedIndex < 0) selectedIndex = 0;
      }

      // Optional full redraw (for init or resize)
      if (fullRender) {
        buf.write(ansi.clear());
        drawBox(buf, 1, 1, cols, rows - 1, "rounded");
        buf.moveTo(1, 3).write(ansi.fg("255", " Server Connection Logs "));

        const keybindings = [
          { action: "Navigate", key: "↑ ↓ ← →" },
          { action: "Search", key: "type" },
          { action: "Back/Clear", key: "<esc>" },
        ];
        drawFooter(buf, cols, rows, keybindings, footerOffset);
      }

      // Search Bar area (rows 2, 3, 4)
      const part1 = searchInput.slice(0, cursorPos);
      const charAtCursor = searchInput[cursorPos] || " ";
      const part2 = searchInput.slice(cursorPos + 1);

      let searchLine = "";
      if (searchInput.length === 0) {
        searchLine = `  ${ansi.bg("240", colors.gray("S"))}${colors.gray("earch…")}`;
      } else {
        searchLine = `  ${part1}${ansi.bg("240", charAtCursor)}${part2}`;
      }

      writeFullRow(buf, 2, 2, cols - 2, searchLine);
      buf.moveTo(3, 1).write("├" + "─".repeat(cols - 2) + "┤");

      // List header (row 4)
      const headerStr = `  Time                 Server Name`;
      buf.moveTo(4, 2).write(ansi.dim(padOrTruncate(headerStr, cols - 2)));

      // List area (row 5 to rows - 2)
      const listTop = 5;
      const listHeight = rows - 2 - listTop;
      const maxColWidth = cols - 2;

      // Adjust scroll offset
      if (selectedIndex < listOffset) listOffset = selectedIndex;
      if (selectedIndex >= listOffset + listHeight)
        listOffset = selectedIndex - listHeight + 1;
      if (listHeight >= filtered.length) listOffset = 0;

      for (let i = 0; i < listHeight; i++) {
        const itemIdx = listOffset + i;
        if (itemIdx >= filtered.length) {
          // Clear unused rows
          buf.moveTo(listTop + i, 2).write(" ".repeat(maxColWidth));
          continue;
        }

        const lg = filtered[itemIdx];
        const isSelected = itemIdx === selectedIndex;
        const baseBg = isSelected ? `${ESC}48;5;238m` : "";
        const searchWords = searchInput
          .toLowerCase()
          .trim()
          .split(/\s+/)
          .filter((w) => w.length > 0);

        const timeStr = colors.dim(
          highlightTerms(
            lg.time ?? "Unknown Time",
            searchWords,
            baseBg + "\x1b[2m",
          ),
        );
        const nameStr = colors.blueBright(
          highlightTerms(
            lg.serverName ?? lg.server ?? "Unknown Server",
            searchWords,
            baseBg + "\x1b[94m",
          ),
        );

        let logStr = `  ${timeStr}  ${nameStr}`;
        let displayStr = padOrTruncate(logStr, maxColWidth);

        if (isSelected) {
          buf.moveTo(listTop + i, 2).write(`${ansi.bg(238, displayStr)}`);
        } else {
          buf.moveTo(listTop + i, 2).write(displayStr);
        }
      }

      // Draw Scrollbar
      drawScrollbar(
        buf,
        cols,
        listTop,
        listHeight,
        filtered.length,
        listHeight,
        listOffset,
        "255",
      );

      if (filtered.length === 0) {
        const noResStr =
          searchInput.length > 0
            ? "No logs match your search"
            : "No server connections have been logged!";
        buf
          .moveTo(listTop + 1, 2)
          .write(ansi.dim(padOrTruncate("  " + noResStr, maxColWidth)));
      }

      buf.write(ansi.hideCursor());
      buf.flush();
    };

    const cleanupScreen = () => {
      process.stdout.removeListener("resize", resizeHandler);
      cleanup();
      process.stdout.write(
        ansi.showCursor() + ansi.clear() + ansi.moveTo(1, 1),
      );
    };

    const { stdin, cleanup } = setupInput((key, char) => {
      if (key === "escape") {
        if (searchInput.length > 0) {
          searchInput = "";
          cursorPos = 0;
          filtered = getFiltered();
          selectedIndex = 0;
          render();
        } else {
          cleanupScreen();
          resolve(["main"]);
        }
        return;
      }

      if (key === "shift-tab") {
        footerOffset++;
        render();
        return;
      }

      if (key === "backspace") {
        if (cursorPos > 0) {
          searchInput =
            searchInput.slice(0, cursorPos - 1) + searchInput.slice(cursorPos);
          cursorPos--;
          filtered = getFiltered();
          selectedIndex = 0;
          render();
        }
        return;
      }

      if (key === "left") {
        if (cursorPos > 0) {
          cursorPos--;
          render();
        }
        return;
      }

      if (key === "right") {
        if (cursorPos < searchInput.length) {
          cursorPos++;
          render();
        }
        return;
      }

      if (key === "char" && char) {
        searchInput =
          searchInput.slice(0, cursorPos) + char + searchInput.slice(cursorPos);
        cursorPos += char.length;
        filtered = getFiltered();
        selectedIndex = 0;
        render();
        return;
      }

      if (key === "up") {
        if (filtered.length > 0) {
          selectedIndex--;
          if (selectedIndex < 0) selectedIndex = filtered.length - 1;
        }
        render();
        return;
      }

      if (key === "down") {
        if (filtered.length > 0) {
          selectedIndex++;
          if (selectedIndex >= filtered.length) selectedIndex = 0;
        }
        render();
        return;
      }

      if (key === "ctrl-c") {
        cleanupScreen();
        resolve(["exit"]);
        return;
      }
    });

    const resizeHandler = () => render(true);
    process.stdout.on("resize", resizeHandler);
    render(true);
  });
}
