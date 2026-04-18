import colors from "yoctocolors-cjs";
import { menu, server, config as Config } from "../../../utils/types";
import { setupInput } from "../../../utils/tui/input";
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
} from "../../../utils/tui/index";
import stringPadding from "../../../utils/stringPadding";
import fs from "fs";
import saveFile from "../../../utils/saveFile";
import dayjs from "dayjs";

import { drawPopup, fillRegion } from "../../../utils/tui/index";
import { performDelete } from "./delete";

export default function listConnections(
  config: Config,
): Promise<[menu, string[]]> {
  let servers = config.servers;
  return new Promise((resolve) => {
    let searchInput = "";
    let cursorPos = 0;
    let selectedIndex = 0;
    let listOffset = 0;
    let footerOffset = 0;

    // Popup state
    let showDeleteConfirm = false;
    let popupSelectedIndex = 1; // Default to Cancel (index 1)

    // Multi-selection state
    const selectedIndices = new Set<number>();

    // Export popup state
    let showExportPrompt = false;
    let exportPathInput = "";
    let exportCursorPos = 0;
    let exportError = "";

    // Filter servers based on input
    const getFiltered = () => {
      const q = searchInput.toLowerCase().trim();
      if (!q)
        return servers.map((srv, idx) => ({ ...srv, originalIndex: idx }));

      const words = q.split(/\s+/).filter((w) => w.length > 0);

      return servers
        .map((srv, idx) => ({ ...srv, originalIndex: idx }))
        .filter((srv) => {
          return words.some((word) => {
            return (
              (srv.name ?? "").toLowerCase().includes(word) ||
              (srv.host ?? "").toLowerCase().includes(word) ||
              (srv.username ?? "").toLowerCase().includes(word) ||
              String(srv.port ?? "").includes(word)
            );
          });
        });
    };

    let filtered = getFiltered();

    const render = (
      fullRender: boolean = false,
      popupOnly: boolean = false,
    ) => {
      const { rows, cols } = getTermSize();
      const buf = new ScreenBuffer();

      if (popupOnly && showExportPrompt) {
        const count = selectedIndices.size > 0 ? selectedIndices.size : 1;

        let displayInput = exportPathInput;
        // if empty maybe show a placeholder? No, standard is block cursor or nothing
        const part1 = exportPathInput.slice(0, exportCursorPos);
        const charAtCursor = exportPathInput[exportCursorPos] || " ";
        const part2 = exportPathInput.slice(exportCursorPos + 1);
        displayInput = `${part1}${ansi.bg("240", charAtCursor)}${part2}`;

        const lines = [
          `Exporting ${count} server(s). Enter file path:`,
          "",
          `  > ${displayInput}`,
          "",
        ];
        if (exportError) {
          lines.push(ansi.fg("160", `  ${exportError}`));
          lines.push("");
        }

        drawPopup(buf, " Export Connections ", lines, [], 0, "255", false);
        buf.flush();
        return;
      }

      if (popupOnly && showDeleteConfirm) {
        let msg = "";
        let count = selectedIndices.size;
        if (count > 0) {
          msg = `Are you sure you want to delete ${count} selected server${count > 1 ? "s" : ""}?`;
        } else {
          const srv = filtered[selectedIndex];
          msg = `Are you sure you want to delete ${srv.name}?`;
        }

        drawPopup(
          buf,
          " Confirm Deletion ",
          [msg, "This action cannot be undone."],
          ["Confirm", "Cancel"],
          popupSelectedIndex,
          "160", // Red color (approx)
          true, // onlyChoices
        );
        buf.flush();
        return;
      }

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
        buf.moveTo(1, 3).write(ansi.fg("255", " Saved Connections "));
      }

      // Footer message based on mode
      let keybindings: { action: string; key: string }[] = [];
      if (showDeleteConfirm) {
        keybindings = [
          { action: "Confirm", key: "<enter>" },
          { action: "Cancel", key: "<esc>" },
          { action: "Navigate", key: "↑ ↓ ← →" },
        ];
      } else if (showExportPrompt) {
        keybindings = [
          { action: "Type", key: "chars" },
          { action: "Cursor", key: "← →" },
          { action: "Confirm", key: "<enter>" },
          { action: "Cancel", key: "<esc>" },
        ];
      } else {
        keybindings = [
          { action: "Navigate", key: "↑ ↓" },
          { action: "Details", key: "<enter>" },
          { action: "Select/Deselect", key: "<ctrl-space>" },
          { action: "Export", key: "<ctrl-e>" },
          { action: "Delete", key: "<ctrl-del>" },
          { action: "Search", key: "type" },
          { action: "Back/Clear", key: "<esc>" },
        ];
      }
      drawFooter(buf, cols, rows, keybindings, footerOffset);

      // Search Bar area (rows 2, 3, 4)
      const part1 = searchInput.slice(0, cursorPos);
      const charAtCursor = searchInput[cursorPos] || " ";
      const part2 = searchInput.slice(cursorPos + 1);

      writeFullRow(
        buf,
        2,
        2,
        cols - 2,
        `  Search: ${part1}${ansi.bg("240", charAtCursor)}${part2}`,
      );
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
        if (itemIdx >= filtered.length) {
          // Clear unused rows so old data vanishes when list shrinks
          buf.moveTo(listTop + i, 2).write(" ".repeat(maxColWidth));
          continue;
        }

        const srv = filtered[itemIdx];
        const isSelected = itemIdx === selectedIndex;
        const baseBg = isSelected ? `${ESC}48;5;238m` : "";
        const searchWords = searchInput
          .toLowerCase()
          .trim()
          .split(/\s+/)
          .filter((w) => w.length > 0);

        const displayIdx = colors.dim(
          stringPadding(`${srv.originalIndex + 1}`, 3, "start", "0"),
        );

        const highlightedName = highlightTerms(
          srv.name ?? "",
          searchWords,
          baseBg,
        );
        const paddedName = stringPadding(highlightedName);

        const highlightedUser = highlightTerms(
          srv.username ?? "",
          searchWords,
          baseBg + "\x1b[33m",
        );
        const highlightedHost = highlightTerms(
          srv.host ?? "",
          searchWords,
          baseBg + "\x1b[34m",
        );
        const highlightedPort = highlightTerms(
          String(srv.port ?? ""),
          searchWords,
          baseBg + "\x1b[35m",
        );

        const checkMark = selectedIndices.has(srv.originalIndex)
          ? colors.cyan("✓")
          : " ";

        let srvStr = ` ${checkMark}${displayIdx}  ${paddedName}  ${colors.yellow(
          highlightedUser,
        )}@${colors.blue(highlightedHost)}:${colors.magenta(highlightedPort)}`;

        let displayStr = padOrTruncate(srvStr, maxColWidth);

        if (isSelected) {
          buf.moveTo(listTop + i, 2).write(`${ansi.bg(238, displayStr)}`);
        } else {
          buf.moveTo(listTop + i, 2).write(displayStr);
        }
      }

      // Draw Scrollbar unconditionally (renders as a static line if not scrolling)
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
            ? "No servers match your search"
            : "No saved servers";
        buf
          .moveTo(listTop + 1, 2)
          .write(ansi.dim(padOrTruncate("  " + noResStr, maxColWidth)));
      }

      // Draw Popup if active
      if (showDeleteConfirm && !showExportPrompt) {
        let msg = "";
        let count = selectedIndices.size;
        if (count > 0) {
          msg = `Are you sure you want to delete ${count} selected server${count > 1 ? "s" : ""}?`;
        } else {
          const srv = filtered[selectedIndex];
          msg = `Are you sure you want to delete ${srv.name}?`;
        }

        drawPopup(
          buf,
          " Confirm Deletion ",
          [msg, "This action cannot be undone."],
          ["Confirm", "Cancel"],
          popupSelectedIndex,
          "160", // Red color (approx)
        );
      }

      // Hide cursor and flush
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
      if (showDeleteConfirm) {
        if (
          key === "left" ||
          key === "right" ||
          key === "up" ||
          key === "down" ||
          key === "tab"
        ) {
          popupSelectedIndex = popupSelectedIndex === 0 ? 1 : 0;
          render(false, true);
        } else if (key === "enter") {
          if (popupSelectedIndex === 0) {
            // Confirm delete
            let indicesToRemove: number | number[];
            if (selectedIndices.size > 0) {
              indicesToRemove = Array.from(selectedIndices);
            } else {
              const srv = filtered[selectedIndex];
              indicesToRemove = srv.originalIndex;
            }

            performDelete(config, indicesToRemove).then((newConfig) => {
              config = newConfig;
              servers = config.servers;
              searchInput = "";
              filtered = getFiltered();
              showDeleteConfirm = false;
              selectedIndices.clear();
              selectedIndex = 0;
              render();
            });
          } else {
            // Cancel
            showDeleteConfirm = false;
            render();
          }
        } else if (key === "escape") {
          showDeleteConfirm = false;
          render();
        }
        return;
      }

      if (showExportPrompt) {
        if (key === "escape") {
          showExportPrompt = false;
          exportError = "";
          render(false, true);
          return;
        }

        if (key === "backspace") {
          exportError = "";
          if (exportCursorPos > 0) {
            exportPathInput =
              exportPathInput.slice(0, exportCursorPos - 1) +
              exportPathInput.slice(exportCursorPos);
            exportCursorPos--;
            render(false, true);
          }
          return;
        }

        if (key === "left") {
          if (exportCursorPos > 0) {
            exportCursorPos--;
            render(false, true);
          }
          return;
        }

        if (key === "right") {
          if (exportCursorPos < exportPathInput.length) {
            exportCursorPos++;
            render(false, true);
          }
          return;
        }

        if (key === "char" && char) {
          exportError = "";
          exportPathInput =
            exportPathInput.slice(0, exportCursorPos) +
            char +
            exportPathInput.slice(exportCursorPos);
          exportCursorPos += char.length;
          render(false, true);
          return;
        }

        if (key === "enter") {
          if (!exportPathInput.trim()) {
            exportError = "Filename cannot be empty.";
            render(false, true);
            return;
          }

          if (fs.existsSync(exportPathInput)) {
            exportError = "File already exists!";
            render(false, true);
            return;
          }

          let serversToExport: server[] = [];
          if (selectedIndices.size > 0) {
            serversToExport = config.servers.filter((_, idx) =>
              selectedIndices.has(idx),
            );
          } else if (filtered.length > 0) {
            serversToExport = [filtered[selectedIndex]];
          }

          saveFile(exportPathInput, serversToExport)
            .then(() => {
              showExportPrompt = false;
              exportError = "";
              render();
            })
            .catch((err) => {
              exportError = "Error saving: " + err.message;
              render(false, true);
            });
        }
        return;
      }

      if (key === "ctrl-space") {
        if (filtered.length > 0) {
          const srv = filtered[selectedIndex];
          if (selectedIndices.has(srv.originalIndex)) {
            selectedIndices.delete(srv.originalIndex);
          } else {
            selectedIndices.add(srv.originalIndex);
          }
          render();
        }
        return;
      }

      if (key === "ctrl-e") {
        if (filtered.length > 0) {
          showExportPrompt = true;
          exportPathInput = `config-export-${dayjs().format("YYYY-MM-DD---HH-mm-ss")}.cfg`;
          exportCursorPos = exportPathInput.length;
          exportError = "";
          render(false, true);
        }
        return;
      }

      if (key === "shift-tab" && !showDeleteConfirm && !showExportPrompt) {
        footerOffset++;
        render();
        return;
      }

      if (key === "escape") {
        if (searchInput.length > 0 || selectedIndices.size > 0) {
          if (searchInput.length > 0) {
            searchInput = "";
            cursorPos = 0;
            filtered = getFiltered();
            selectedIndex = 0;
          } else {
            selectedIndices.clear();
          }
          render();
        } else {
          cleanupScreen();
          resolve(["main", []]);
        }
        return;
      }

      if (key === "ctrl-delete") {
        if (filtered.length > 0) {
          showDeleteConfirm = true;
          popupSelectedIndex = 1; // Default to Cancel
          render();
        }
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
        // Only printable text
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

    const resizeHandler = () => render(true);
    process.stdout.on("resize", resizeHandler);
    render(true);
  });
}
