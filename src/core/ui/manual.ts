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

type RenderItem = {
  text: string;
  isSelectable: boolean;
  cmdIndex?: number;
};

export default function manual(program: Command): Promise<[menu]> {
  return new Promise((resolve) => {
    let mode: "root" | "help" = "root";
    let selectedRenderIndex = -1;
    let listOffset = 0;
    let helpOffset = 0;

    // Build the array of command help texts
    const items = program.commands.map((c) => ({
      name: c.name(),
      help: c.helpInformation(),
    }));

    // Parse the root help string to construct the root view
    const rootHelpLines = program.helpInformation().split("\n");
    const renderItems: RenderItem[] = [];
    let inCommands = false;

    for (const line of rootHelpLines) {
      // Remove carriage returns if any
      const cleanedLine = line.replace(/\r/g, "");
      
      if (cleanedLine.trim() === "Commands:") {
        inCommands = true;
        renderItems.push({ text: cleanedLine, isSelectable: false });
      } else if (inCommands && cleanedLine.trim().length > 0) {
        // It's a command line
        const firstWord = cleanedLine.trim().split(" ")[0];
        const cmdIndex = items.findIndex((item) => item.name === firstWord);
        
        renderItems.push({
          text: cleanedLine,
          isSelectable: true,
          cmdIndex: cmdIndex !== -1 ? cmdIndex : undefined,
        });
        
        if (selectedRenderIndex === -1 && cmdIndex !== -1) {
          selectedRenderIndex = renderItems.length - 1; // set first selectable as default
        }
      } else {
        renderItems.push({ text: cleanedLine, isSelectable: false });
      }
    }

    // Default to 0 if not set
    if (selectedRenderIndex === -1) {
      selectedRenderIndex = renderItems.findIndex((r) => r.isSelectable);
      if (selectedRenderIndex === -1) selectedRenderIndex = 0; 
    }

    let activeCmdIndex = 0; // used when viewing specific help

    const render = (fullRender: boolean = false) => {
      const { rows, cols } = getTermSize();
      const buf = new ScreenBuffer();

      if (fullRender) {
        buf.write(ansi.clear());
      }
      
      drawBox(buf, 1, 1, cols, rows - 1, "rounded");
      buf.moveTo(1, 3).write(ansi.fg("255", " Manual "));

      if (mode === "root") {
        const footerMsg = "Scroll: ↑ ↓ | Select: <enter> | Back: <esc> ";
        drawFooter(buf, cols, rows, footerMsg);
        
        const titleStr = padOrTruncate(` Help: sshman (root) `, cols - 6);
        buf.moveTo(2, 3).write(titleStr);
        buf.moveTo(3, 1).write("├" + "─".repeat(cols - 2) + "┤");

        const listTop = 4;
        const listHeight = rows - 2 - listTop;
        const maxColWidth = cols - 2;

        // If the selected item goes out of view, adjust offset
        if (selectedRenderIndex < listOffset) listOffset = selectedRenderIndex;
        if (selectedRenderIndex >= listOffset + listHeight) {
          listOffset = selectedRenderIndex - listHeight + 1;
        }
        if (listHeight >= renderItems.length) listOffset = 0;

        for (let i = 0; i < listHeight; i++) {
          const itemIdx = listOffset + i;
          if (itemIdx >= renderItems.length) {
            buf.moveTo(listTop + i, 2).write(" ".repeat(maxColWidth));
            continue;
          }

          const rItem = renderItems[itemIdx];
          const isSelected = itemIdx === selectedRenderIndex && rItem.isSelectable;
          
          let text = padOrTruncate(rItem.text, maxColWidth - 2);
          const displayStr = padOrTruncate("  " + text, maxColWidth);

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
          renderItems.length,
          listHeight,
          listOffset,
          "255"
        );
      } else {
        const footerMsg = "Scroll: ↑ ↓ | Back: <esc> ";
        drawFooter(buf, cols, rows, footerMsg);
        
        const item = items[activeCmdIndex];
        const titleStr = padOrTruncate(` Help: ${item?.name || "Unknown"} `, cols - 6);
        buf.moveTo(2, 3).write(titleStr);
        buf.moveTo(3, 1).write("├" + "─".repeat(cols - 2) + "┤");
        
        const helpLines = (item?.help || "").split("\n");
        
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
          mode = "root";
          render(true);
        } else {
          cleanupScreen();
          resolve(["main"]);
        }
        return;
      }
      
      if (key === "ctrl-c") {
        cleanupScreen();
        resolve(["exit"]);
        return;
      }

      if (mode === "root") {
        if (key === "up") {
          do {
            selectedRenderIndex--;
            if (selectedRenderIndex < 0) selectedRenderIndex = renderItems.length - 1;
          } while (!renderItems[selectedRenderIndex].isSelectable);
          render();
          return;
        }

        if (key === "down") {
          do {
            selectedRenderIndex++;
            if (selectedRenderIndex >= renderItems.length) selectedRenderIndex = 0;
          } while (!renderItems[selectedRenderIndex].isSelectable);
          render();
          return;
        }

        if (key === "enter") {
          const rItem = renderItems[selectedRenderIndex];
          if (rItem && rItem.isSelectable && rItem.cmdIndex !== undefined) {
            mode = "help";
            activeCmdIndex = rItem.cmdIndex;
            helpOffset = 0;
            render(true);
          }
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
