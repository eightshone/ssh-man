import { menu, server } from "../../../utils/types";
import { setupInput } from "../../../utils/tui/input";
import {
  ansi,
  ScreenBuffer,
  drawBox,
  writeTextCentered,
  writeFullRow,
  padOrTruncate,
  getTermSize,
  visibleLength,
  drawScrollbar,
} from "../../../utils/tui/index";
import stringPadding from "../../../utils/stringPadding";

export default function listConnections(
  servers: server[],
): Promise<[menu, string[]]> {
  return new Promise((resolve) => {
    let searchInput = "";
    let selectedIndex = 0;
    let listOffset = 0;

    // Filter servers based on input
    const getFiltered = () => {
      const q = searchInput.toLowerCase();
      if (!q)
        return servers.map((srv, idx) => ({ ...srv, originalIndex: idx }));

      return servers
        .map((srv, idx) => ({ ...srv, originalIndex: idx }))
        .filter(
          (srv) =>
            srv.name.toLowerCase().includes(q) ||
            srv.host.toLowerCase().includes(q) ||
            srv.username.toLowerCase().includes(q) ||
            String(srv.port).includes(q),
        );
    };

    let filtered = getFiltered();

    const render = () => {
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

      // Clear screen and draw main rounded box
      buf.write(ansi.clear());
      drawBox(buf, 1, 1, cols, rows - 1, "rounded");

      // Title
      writeTextCentered(buf, 1, 1, cols - 2, " Saved Servers ", "208");

      // Search Bar area (rows 2, 3, 4)
      writeFullRow(
        buf,
        2,
        2,
        cols - 2,
        ` 🔍 Search: ${searchInput}${ansi.bg("240", " ")}`,
      ); // faux cursor
      buf.moveTo(3, 1).write("├" + "─".repeat(cols - 2) + "┤");

      // List header (row 4)
      const headerStr = `    #  ${stringPadding("Name")}  Config`;
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
        if (itemIdx >= filtered.length) break;

        const srv = filtered[itemIdx];
        const displayIdx = stringPadding(
          `${srv.originalIndex + 1}`,
          3,
          "start",
          "0",
        );
        const paddedName = stringPadding(srv.name);
        let srvStr = `  ${displayIdx}  ${paddedName}  ${srv.username}@${srv.host}:${srv.port}`;

        let displayStr = padOrTruncate(srvStr, maxColWidth);

        if (itemIdx === selectedIndex) {
          buf.moveTo(listTop + i, 2).write(`${ansi.bg(238, displayStr)}`);
        } else {
          buf.moveTo(listTop + i, 2).write(displayStr);
        }
      }

      // Draw Scrollbar
      if (filtered.length > 0) {
        drawScrollbar(
          buf,
          cols - 1,
          listTop,
          listHeight,
          filtered.length,
          listHeight,
          listOffset,
          "250",
        );
      } else {
        const noResStr =
          searchInput.length > 0
            ? "📭 No servers match your search"
            : "📭 No saved servers";
        buf
          .moveTo(listTop + 1, 2)
          .write(ansi.dim(padOrTruncate("  " + noResStr, maxColWidth)));
      }

      // Footer
      const footerMsg =
        " Navigate: ↑ ↓ | Select: <enter> | Search: type | Back/Clear: <esc> ";
      const footerCol = 2;

      buf
        .moveTo(rows, footerCol)
        .write(ansi.bg("236", ansi.fg("250", footerMsg)));

      // Hide cursor and flush
      buf.write(ansi.hideCursor());
      buf.flush();
    };

    const cleanupScreen = () => {
      process.stdout.removeListener("resize", render);
      cleanup();
      process.stdout.write(
        ansi.showCursor() + ansi.clear() + ansi.moveTo(1, 1),
      );
    };

    const { stdin, cleanup } = setupInput((key, char) => {
      if (key === "escape") {
        if (searchInput.length > 0) {
          searchInput = "";
          filtered = getFiltered();
          selectedIndex = 0;
          render();
        } else {
          cleanupScreen();
          resolve(["main", []]);
        }
        return;
      }

      if (key === "backspace") {
        if (searchInput.length > 0) {
          searchInput = searchInput.slice(0, -1);
          filtered = getFiltered();
          selectedIndex = 0;
          render();
        }
        return;
      }

      if (key === "char" && char) {
        // Only printable text
        searchInput += char;
        filtered = getFiltered();
        selectedIndex = 0;
        render();
        return;
      }

      if (key === "up") {
        if (filtered.length > 0) {
          selectedIndex--;
          if (selectedIndex < 0) selectedIndex = filtered.length - 1; // loop
        }
        render();
        return;
      }

      if (key === "down") {
        if (filtered.length > 0) {
          selectedIndex++;
          if (selectedIndex >= filtered.length) selectedIndex = 0; // loop
        }
        render();
        return;
      }

      if (key === "enter") {
        if (filtered.length > 0) {
          const selectedSrv = filtered[selectedIndex];
          cleanupScreen();
          resolve([
            "ssh-display",
            [JSON.stringify(selectedSrv), String(selectedSrv.originalIndex)],
          ]);
        }
        return;
      }

      // ctrl-c always quits the app (node handles this depending on app flow, but we can pass 'exit')
      if (key === "ctrl-c") {
        cleanupScreen();
        resolve(["exit", []]);
        return;
      }
    });

    process.stdout.on("resize", render);
    render();
  });
}
