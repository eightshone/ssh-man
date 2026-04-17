import { Command } from "commander";
import { menu } from "../../utils/types";
import { setupInput } from "../../utils/tui/input";
import {
  ansi,
  ScreenBuffer,
  drawBox,
  padOrTruncate,
  getTermSize,
  drawFooter,
  drawScrollbar,
} from "../../utils/tui/index";

export default function manual(program: Command): Promise<[menu]> {
  return new Promise((resolve) => {
    let mode: "list" | "help" = "list";
    let selectedIndex = 0;
    let listOffset = 0;
    
    // Help scroll offset
    let helpOffset = 0;

    const items = [
      { name: "sshman (root)", help: program.helpInformation() },
      ...program.commands.map((c) => ({
        name: c.name(),
        help: c.helpInformation(),
      })),
    ];

    const render = (fullRender: boolean = false) => {
      const { rows, cols } = getTermSize();
      const buf = new ScreenBuffer();

      if (fullRender) {
        buf.write(ansi.clear());
      }
      
      // Draw outer box
      drawBox(buf, 1, 1, cols, rows - 1, "rounded");
      buf.moveTo(1, 3).write(ansi.fg("255", " Manual "));

      if (mode === "list") {
        const footerMsg = "Navigate: ↑ ↓ | View help: <enter> | Back: <esc> ";
        drawFooter(buf, cols, rows, footerMsg);

        const listTop = 3;
        // height is total row size minus borders and footer
        const listHeight = rows - 2 - listTop;
        const maxColWidth = cols - 2;

        if (selectedIndex < listOffset) listOffset = selectedIndex;
        if (selectedIndex >= listOffset + listHeight) listOffset = selectedIndex - listHeight + 1;
        if (listHeight >= items.length) listOffset = 0;

        for (let i = 0; i < listHeight; i++) {
          const itemIdx = listOffset + i;
          if (itemIdx >= items.length) {
            buf.moveTo(listTop + i, 2).write(" ".repeat(maxColWidth));
            continue;
          }

          const item = items[itemIdx];
          const isSelected = itemIdx === selectedIndex;
          
          const displayStr = padOrTruncate("  " + item.name, maxColWidth);

          if (isSelected) {
            buf.moveTo(listTop + i, 2).write(`${ansi.bg(238, displayStr)}`);
          } else {
            buf.moveTo(listTop + i, 2).write(displayStr);
          }
        }
        
        drawScrollbar(
          buf,
          cols,
          listTop,
          listHeight,
          items.length,
          listHeight,
          listOffset,
          "255"
        );
      } else {
        const footerMsg = "Scroll: ↑ ↓ | Back: <esc> ";
        drawFooter(buf, cols, rows, footerMsg);
        
        const item = items[selectedIndex];
        const titleStr = padOrTruncate(` Help: ${item.name} `, cols - 6);
        buf.moveTo(2, 3).write(titleStr);
        // Underline or separator
        buf.moveTo(3, 1).write("├" + "─".repeat(cols - 2) + "┤");
        
        const helpLines = item.help.split("\n");
        
        const listTop = 4;
        const listHeight = rows - 2 - listTop;
        const maxColWidth = cols - 2;

        if (helpOffset < 0) helpOffset = 0;
        if (helpOffset > helpLines.length - listHeight) {
          helpOffset = Math.max(0, helpLines.length - listHeight);
        }

        for (let i = 0; i < listHeight; i++) {
          const lineIdx = helpOffset + i;
          if (lineIdx >= helpLines.length) {
            buf.moveTo(listTop + i, 2).write(" ".repeat(maxColWidth));
            continue;
          }

          let text = helpLines[lineIdx].replace(/\r/g, "");
          const blankPrefix = "  ";
          const visibleLimit = maxColWidth - blankPrefix.length;
          
          text = padOrTruncate(text, visibleLimit);
          buf.moveTo(listTop + i, 2).write(blankPrefix + text);
        }
        
        drawScrollbar(
          buf,
          cols,
          listTop,
          listHeight,
          helpLines.length,
          listHeight,
          helpOffset,
          "255"
        );
      }

      buf.write(ansi.hideCursor());
      buf.flush();
    };

    const cleanupScreen = () => {
      process.stdout.removeListener("resize", resizeHandler);
      cleanup();
      process.stdout.write(ansi.showCursor() + ansi.clear() + ansi.moveTo(1, 1));
    };

    const { stdin, cleanup } = setupInput((key, char) => {
      if (key === "escape") {
        if (mode === "help") {
          mode = "list";
          render(true);
        } else {
          cleanupScreen();
          resolve(["main"]);
        }
        return;
      }
      
      if (key === "ctrl-c") {
        cleanupScreen();
        process.exit(0);
        return;
      }

      if (mode === "list") {
        if (key === "up") {
          selectedIndex--;
          if (selectedIndex < 0) selectedIndex = items.length - 1;
          render();
          return;
        }

        if (key === "down") {
          selectedIndex++;
          if (selectedIndex >= items.length) selectedIndex = 0;
          render();
          return;
        }

        if (key === "enter") {
          mode = "help";
          helpOffset = 0;
          render(true);
          return;
        }
      } else {
        if (key === "up") {
          helpOffset--;
          render();
          return;
        }

        if (key === "down") {
          helpOffset++;
          render();
          return;
        }
      }
    });

    const resizeHandler = () => render(true);
    process.stdout.on("resize", resizeHandler);
    render(true);
  });
}
