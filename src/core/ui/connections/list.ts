import colors from "yoctocolors-cjs";
import { menu, server, config as Config } from "../../../utils/types";
import { setupInput } from "../../../utils/tui/input";
import {
  ansi,
  ScreenBuffer,
  drawBox,
  writeFullRow,
  writeTextCentered,
  padOrTruncate,
  getTermSize,
  drawScrollbar,
  drawFooter,
  highlightTerms,
  ESC,
  drawPopup,
  fillRegion,
} from "../../../utils/tui/index";
import stringPadding from "../../../utils/stringPadding";
import fs from "fs";
import path from "path";
import saveFile from "../../../utils/saveFile";
import clipboard from "clipboardy";
import { performDelete } from "./delete";
import { encryptWithPassword } from "../../../utils/crypto";
import readConfigFile from "../../../utils/readConfigFile";
import validateServers from "../../../utils/validateServers";
import normalizeServerName from "../../../utils/normalizeServerName";
import { CONFIG_DIR } from "../../../utils/consts";

// ── Module-level state (persists across navigations) ──────────────────────────
let searchInput = "";
let cursorPos = 0;
let selectedIndex = 0;
let listOffset = 0;
let footerOffset = 0;

const selectedIndices = new Set<number>();

// ── Shared types ──────────────────────────────────────────────────────────────
type BrowserEntry = { name: string; isDir: boolean };
type ExportStep   = "filename" | "password" | "confirm_password" | "abort_confirm" | "result";
type ImportStep   = "file_browser" | "password" | "conflict_choice" | "abort_confirm" | "result";

// ─────────────────────────────────────────────────────────────────────────────
export default function listConnections(
  config: Config,
  initialOptions?: string[] | null,
): Promise<[menu, string[]]> {
  let servers = config.servers;

  return new Promise((resolve) => {

    // ── Delete confirm ────────────────────────────────────────────────────────
    let showDeleteConfirm   = false;
    let popupSelectedIndex  = 1; // default to Cancel

    // ── Export state ──────────────────────────────────────────────────────────
    let showExportPrompt        = false;
    let exportStep: ExportStep  = "filename";
    let exportServersToExport   : server[] = [];
    let exportFilenameInput     = "";
    let exportFilenameCursor    = 0;
    let exportPasswordInput     = "";
    let exportConfirmInput      = "";
    let exportPasswordCursor    = 0;
    let exportPasswordError     = "";
    let exportAbortIndex        = 0;               // 0=Stay, 1=Abort
    let exportAbortReturnStep   : ExportStep = "password";
    let exportResultSuccess     = false;
    let exportResultMessage     = "";

    // ── Import state ──────────────────────────────────────────────────────────
    let showImportPrompt        = false;
    let importStep: ImportStep  = "file_browser";
    let importBrowserPath       = process.cwd();
    let importEntries           : BrowserEntry[] = [];
    let importBrowserOffset     = 0;
    let importBrowserSelected   = 0;
    let importSelectedFile      = "";
    let importPasswordInput     = "";
    let importPasswordCursor    = 0;
    let importPasswordError     = "";
    let importedServers         : server[] = [];
    let importAbortIndex        = 0;               // 0=Stay, 1=Abort
    let importAbortReturnStep   : ImportStep = "password";
    let importResultSuccess     = false;
    let importResultMessage     = "";

    // ── Details popup ─────────────────────────────────────────────────────────
    let showDetailsPopup        = false;
    let detailsSelectedIndex    = 0;
    let showPassword            = false;
    let passwordCopied          = false;

    // ── Handle initial options (e.g. return from Edit) ───────────────────────
    if (initialOptions && initialOptions[0]) {
      try {
        const target   = JSON.parse(initialOptions[0]);
        const foundIdx = servers.findIndex((s) => s.id === target.id);
        if (foundIdx !== -1) {
          selectedIndex    = foundIdx;
          showDetailsPopup = true;
        }
      } catch (_) { /* ignore */ }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    const getFiltered = () => {
      const q = searchInput.toLowerCase().trim();
      if (!q) return servers.map((srv, idx) => ({ ...srv, originalIndex: idx }));
      const words = q.split(/\s+/).filter((w) => w.length > 0);
      return servers
        .map((srv, idx) => ({ ...srv, originalIndex: idx }))
        .filter((srv) =>
          words.some(
            (word) =>
              (srv.name     ?? "").toLowerCase().includes(word) ||
              (srv.host     ?? "").toLowerCase().includes(word) ||
              (srv.username ?? "").toLowerCase().includes(word) ||
              String(srv.port ?? "").includes(word),
          ),
        );
    };

    let filtered = getFiltered();

    /** Read directory entries: ".." first, then dirs (sorted), then files (sorted). */
    const loadBrowserEntries = (dirPath: string): BrowserEntry[] => {
      try {
        const raw     = fs.readdirSync(dirPath, { withFileTypes: true });
        const entries : BrowserEntry[] = [];
        const parent  = path.dirname(dirPath);
        if (parent !== dirPath) entries.push({ name: "..", isDir: true });
        const dirs  = raw.filter((e) => e.isDirectory()).map((e) => ({ name: e.name, isDir: true  })).sort((a, b) => a.name.localeCompare(b.name));
        const files = raw.filter((e) => e.isFile()     ).map((e) => ({ name: e.name, isDir: false })).sort((a, b) => a.name.localeCompare(b.name));
        return [...entries, ...dirs, ...files];
      } catch {
        return [];
      }
    };

    /** Build a masked/plain text input line with a cursor highlight. */
    const inputLine = (value: string, cursor: number, masked = false): string => {
      const text = masked ? "*".repeat(value.length) : value;
      const c1   = text.slice(0, cursor);
      const cc   = text[cursor] ?? " ";
      const c2   = text.slice(cursor + 1);
      return `${c1}${ansi.bg("240", cc)}${c2}`;
    };

    /** Max file rows visible in the file-browser popup given terminal height. */
    const visibleBrowserCount = (rows: number) =>
      Math.min(10, Math.max(3, rows - 10));

    // ─────────────────────────────────────────────────────────────────────────
    // Popup drawing helpers (called from both popupOnly and full-render paths)
    // ─────────────────────────────────────────────────────────────────────────

    const drawExportPopup = (buf: ScreenBuffer, rows: number, cols: number) => {
      switch (exportStep) {

        case "filename": {
          const lines = [
            `Exporting ${exportServersToExport.length} server(s).`,
            "Enter a filename for the export:",
            "",
            `  > ${inputLine(exportFilenameInput, exportFilenameCursor)}`,
            "",
          ];
          if (exportPasswordError) { lines.push(ansi.fg("160", `  ${exportPasswordError}`)); lines.push(""); }
          drawPopup(buf, " Export Connections ", lines, [], 0, "255");
          break;
        }

        case "password": {
          const lines = [
            "Set an encryption password.",
            ansi.dim("Leave empty for no encryption."),
            "",
            `  > ${inputLine(exportPasswordInput, exportPasswordCursor, true)}`,
            "",
          ];
          drawPopup(buf, " Set Password ", lines, [], 0, "255");
          break;
        }

        case "confirm_password": {
          const lines = [
            "Repeat the password.",
            ansi.dim("Leave empty if you didn\u2019t set one."),
            "",
            `  > ${inputLine(exportConfirmInput, exportPasswordCursor, true)}`,
            "",
          ];
          if (exportPasswordError) { lines.push(ansi.fg("160", `  ${exportPasswordError}`)); lines.push(""); }
          drawPopup(buf, " Confirm Password ", lines, [], 0, "255");
          break;
        }

        case "abort_confirm": {
          drawPopup(
            buf,
            " Abort Export? ",
            ["Are you sure you want to abort the export?", "Progress will be lost."],
            ["Stay", "Abort"],
            exportAbortIndex,
            "160",
          );
          break;
        }

        case "result": {
          drawPopup(
            buf,
            exportResultSuccess ? " \u2713 Export Successful " : " \u2717 Export Failed ",
            [exportResultMessage],
            ["Close"],
            0,
            exportResultSuccess ? "82" : "160",
          );
          break;
        }
      }
    };

    const drawImportPopup = (buf: ScreenBuffer, rows: number, cols: number) => {
      switch (importStep) {

        case "file_browser": {
          const popupW       = Math.min(cols - 4, 64);
          const maxVis       = visibleBrowserCount(rows);
          const actualVis    = Math.min(maxVis, Math.max(1, importEntries.length));
          // Layout: top border + breadcrumb + file rows + hint + bottom border
          const popupH       = actualVis + 4;
          const startRow     = Math.floor((rows   - popupH) / 2);
          const startCol     = Math.floor((cols   - popupW) / 2);
          const innerW       = popupW - 5; // -2 borders, -1 left pad, -1 scrollbar, -1 gap

          fillRegion(buf, startRow, startCol, popupW, popupH, " ");
          drawBox(buf, startRow, startCol, popupW, popupH, "rounded", "255");
          writeTextCentered(buf, startRow, startCol, popupW, " Import Connections ", "255");

          // Breadcrumb row
          const maxCrumb  = popupW - 4;
          const crumb     =
            importBrowserPath.length > maxCrumb
              ? "\u2026" + importBrowserPath.slice(-(maxCrumb - 1))
              : importBrowserPath;
          buf.moveTo(startRow + 1, startCol + 2).write(ansi.dim(padOrTruncate(crumb, maxCrumb)));

          // File / directory rows
          if (importEntries.length === 0) {
            buf.moveTo(startRow + 2, startCol + 2)
               .write(ansi.dim(padOrTruncate("  No entries found in this directory", innerW)));
          } else {
            for (let i = 0; i < actualVis; i++) {
              const eIdx   = importBrowserOffset + i;
              if (eIdx >= importEntries.length) break;
              const entry  = importEntries[eIdx];
              const isHl   = eIdx === importBrowserSelected;
              const icon   = entry.isDir ? "\u25b8 " : "  ";
              const label  = entry.isDir
                ? ansi.fg("75", entry.name === ".." ? ".." : entry.name + "/")
                : entry.name;
              const line   = padOrTruncate(icon + label, innerW);
              buf.moveTo(startRow + 2 + i, startCol + 2);
              buf.write(isHl ? ansi.bg(238, line) : line);
            }
          }

          // Hint row
          buf.moveTo(startRow + 2 + actualVis, startCol + 2)
             .write(ansi.dim(padOrTruncate("\u2191\u2193 navigate  Enter select  Esc cancel", popupW - 4)));

          // Scrollbar (only when list overflows)
          if (importEntries.length > actualVis) {
            drawScrollbar(
              buf,
              startCol + popupW - 2,
              startRow + 2,
              actualVis,
              importEntries.length,
              actualVis,
              importBrowserOffset,
              "240",
            );
          }
          break;
        }

        case "password": {
          const lines = [
            "Enter the decryption password.",
            ansi.dim("Leave empty if the file is not encrypted."),
            "",
            `  > ${inputLine(importPasswordInput, importPasswordCursor, true)}`,
            "",
          ];
          if (importPasswordError) { lines.push(ansi.fg("160", `  ${importPasswordError}`)); lines.push(""); }
          drawPopup(buf, " Decryption Password ", lines, [], 0, "255");
          break;
        }

        case "conflict_choice": {
          drawPopup(
            buf,
            " Import Conflict ",
            [
              "One or more server configurations already",
              "exist with the same name.",
              "",
              "What would you like to do?",
            ],
            ["Overwrite", "Skip", "Cancel"],
            popupSelectedIndex,
            "255",
          );
          break;
        }

        case "abort_confirm": {
          drawPopup(
            buf,
            " Abort Import? ",
            ["Are you sure you want to abort the import?"],
            ["Stay", "Abort"],
            importAbortIndex,
            "160",
          );
          break;
        }

        case "result": {
          drawPopup(
            buf,
            importResultSuccess ? " \u2713 Import Successful " : " \u2717 Import Failed ",
            [importResultMessage],
            ["Close"],
            0,
            importResultSuccess ? "82" : "160",
          );
          break;
        }
      }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────

    const render = (fullRender = false, popupOnly = false) => {
      const { rows, cols } = getTermSize();
      const buf            = new ScreenBuffer();

      // ── Fast popup-only paths ─────────────────────────────────────────────
      if (popupOnly && showExportPrompt) {
        drawExportPopup(buf, rows, cols);
        buf.flush();
        return;
      }
      if (popupOnly && showImportPrompt) {
        drawImportPopup(buf, rows, cols);
        buf.flush();
        return;
      }
      if (popupOnly && showDeleteConfirm) {
        const count = selectedIndices.size;
        const msg   = count > 0
          ? `Are you sure you want to delete ${count} selected server${count > 1 ? "s" : ""}?`
          : `Are you sure you want to delete ${filtered[selectedIndex]?.name ?? "this server"}?`;
        drawPopup(buf, " Confirm Deletion ", [msg, "This action cannot be undone."], ["Confirm", "Cancel"], popupSelectedIndex, "160", true);
        buf.flush();
        return;
      }
      if (popupOnly && showDetailsPopup) {
        const srv     = filtered[selectedIndex];
        const choices = buildDetailsChoices(srv);
        drawPopup(buf, " Connection Details ", buildDetailsLines(srv), choices, detailsSelectedIndex, null, false, cols - 6);
        buf.flush();
        return;
      }

      // ── Validate selected index ───────────────────────────────────────────
      if (filtered.length === 0) {
        selectedIndex = 0; listOffset = 0;
      } else {
        if (selectedIndex >= filtered.length) selectedIndex = filtered.length - 1;
        if (selectedIndex < 0)               selectedIndex = 0;
      }

      // ── Full background redraw ────────────────────────────────────────────
      if (fullRender) {
        buf.write(ansi.clear());
        drawBox(buf, 1, 1, cols, rows - 1, "rounded");
        buf.moveTo(1, 3).write(ansi.fg("255", " Saved Connections "));
      }

      // ── Footer keybindings ────────────────────────────────────────────────
      let keybindings: { action: string; key: string }[] = [];
      if (showExportPrompt) {
        if (exportStep === "abort_confirm" || exportStep === "result") {
          keybindings = [{ action: "Navigate", key: "\u2190 \u2192" }, { action: "Confirm", key: "<enter>" }];
        } else if (exportStep === "filename") {
          keybindings = [{ action: "Type", key: "chars" }, { action: "Cursor", key: "\u2190 \u2192" }, { action: "Confirm", key: "<enter>" }, { action: "Cancel", key: "<esc>" }];
        } else {
          keybindings = [{ action: "Type", key: "chars" }, { action: "Confirm", key: "<enter>" }, { action: "Back", key: "<esc>" }];
        }
      } else if (showImportPrompt) {
        if (importStep === "file_browser") {
          keybindings = [{ action: "Navigate", key: "\u2191\u2193" }, { action: "Select", key: "<enter>" }, { action: "Cancel", key: "<esc>" }];
        } else if (importStep === "conflict_choice") {
          keybindings = [{ action: "Navigate", key: "\u2190 \u2192" }, { action: "Confirm", key: "<enter>" }, { action: "Back", key: "<esc>" }];
        } else if (importStep === "abort_confirm" || importStep === "result") {
          keybindings = [{ action: "Navigate", key: "\u2190 \u2192" }, { action: "Confirm", key: "<enter>" }];
        } else {
          keybindings = [{ action: "Type", key: "chars" }, { action: "Confirm", key: "<enter>" }, { action: "Back", key: "<esc>" }];
        }
      } else if (showDeleteConfirm) {
        keybindings = [{ action: "Confirm", key: "<enter>" }, { action: "Cancel", key: "<esc>" }, { action: "Navigate", key: "\u2191\u2193 \u2190\u2192" }];
      } else if (showDetailsPopup) {
        keybindings = [{ action: "Navigate", key: "\u2191\u2193" }, { action: "Select", key: "<enter>" }, { action: "Close", key: "<esc>" }];
      } else {
        keybindings = [
          { action: "Navigate",        key: "\u2191\u2193"      },
          { action: "Details",         key: "<enter>"           },
          { action: "Select/Deselect", key: "<ctrl-space>"      },
          { action: "Export",          key: "<ctrl-e>"          },
          { action: "Import",          key: "<ctrl-o>"          },
          { action: "Delete",          key: "<ctrl-del>"        },
          { action: "Search",          key: "type"              },
          { action: "Back/Clear",      key: "<esc>"             },
        ];
      }
      drawFooter(buf, cols, rows, keybindings, footerOffset);

      // ── Search bar ────────────────────────────────────────────────────────
      const sp1 = searchInput.slice(0, cursorPos);
      const scc = searchInput[cursorPos] || " ";
      const sp2 = searchInput.slice(cursorPos + 1);
      const searchLine =
        searchInput.length === 0
          ? `  ${ansi.bg("240", colors.gray("S"))}${colors.gray("earch\u2026")}`
          : `  ${sp1}${ansi.bg("240", scc)}${sp2}`;
      writeFullRow(buf, 2, 2, cols - 2, searchLine);
      buf.moveTo(3, 1).write("\u251C" + "\u2500".repeat(cols - 2) + "\u2524");

      // ── List header ───────────────────────────────────────────────────────
      buf.moveTo(4, 2).write(ansi.dim(padOrTruncate(`    #  ${stringPadding("Name")}  Config`, cols - 2)));

      // ── List area ─────────────────────────────────────────────────────────
      const listTop    = 5;
      const listHeight = rows - 2 - listTop;
      const maxCW      = cols - 2;

      if (selectedIndex < listOffset) listOffset = selectedIndex;
      if (selectedIndex >= listOffset + listHeight) listOffset = selectedIndex - listHeight + 1;
      if (listHeight >= filtered.length) listOffset = 0;

      for (let i = 0; i < listHeight; i++) {
        const itemIdx = listOffset + i;
        if (itemIdx >= filtered.length) {
          buf.moveTo(listTop + i, 2).write(" ".repeat(maxCW));
          continue;
        }
        const srv        = filtered[itemIdx];
        const isSelected = itemIdx === selectedIndex;
        const baseBg     = isSelected ? `${ESC}48;5;238m` : "";
        const searchWords = searchInput.toLowerCase().trim().split(/\s+/).filter((w) => w.length > 0);
        const lineChecked = selectedIndices.has(srv.originalIndex);
        const checkMark   = lineChecked ? colors.cyan("\u2713") : " ";
        const displayIdx  = selectedIndices.has(srv.originalIndex)
          ? stringPadding(`${srv.originalIndex + 1}`, 3, "start", "0")
          : colors.dim(stringPadding(`${srv.originalIndex + 1}`, 3, "start", "0"));
        const hName  = highlightTerms(srv.name     ?? "", searchWords, baseBg);
        const hUser  = highlightTerms(srv.username ?? "", searchWords, baseBg + "\x1b[33m");
        const hHost  = highlightTerms(srv.host     ?? "", searchWords, baseBg + "\x1b[34m");
        const hPort  = highlightTerms(String(srv.port ?? ""), searchWords, baseBg + "\x1b[35m");
        const srvStr = ` ${checkMark}${displayIdx}  ${stringPadding(hName)}  ${lineChecked ? hUser : colors.yellow(hUser)}@${lineChecked ? hHost : colors.blue(hHost)}:${lineChecked ? hPort : colors.magenta(hPort)}`;
        const dispStr = padOrTruncate(lineChecked ? colors.cyan(srvStr) : srvStr, maxCW);
        buf.moveTo(listTop + i, 2).write(isSelected ? `${ansi.bg(238, dispStr)}` : dispStr);
      }

      // ── Scrollbar ─────────────────────────────────────────────────────────
      drawScrollbar(buf, cols, listTop, listHeight, filtered.length, listHeight, listOffset, "255");

      // ── Empty state ───────────────────────────────────────────────────────
      if (filtered.length === 0) {
        const msg = searchInput.length > 0 ? "No servers match your search" : "No saved servers";
        buf.moveTo(listTop + 1, 2).write(ansi.dim(padOrTruncate("  " + msg, maxCW)));
      }

      // ── Overlay popups ────────────────────────────────────────────────────
      if (showDeleteConfirm && !showImportPrompt && !showExportPrompt) {
        const count = selectedIndices.size;
        const msg   = count > 0
          ? `Are you sure you want to delete ${count} selected server${count > 1 ? "s" : ""}?`
          : `Are you sure you want to delete ${filtered[selectedIndex]?.name ?? "this server"}?`;
        drawPopup(buf, " Confirm Deletion ", [msg, "This action cannot be undone."], ["Confirm", "Cancel"], popupSelectedIndex, "160");
      }
      if (showExportPrompt) {
        drawExportPopup(buf, rows, cols);
      }
      if (showImportPrompt && !showExportPrompt) {
        drawImportPopup(buf, rows, cols);
      }
      if (showDetailsPopup && !showDeleteConfirm && !showImportPrompt && !showExportPrompt) {
        const srv     = filtered[selectedIndex];
        const choices = buildDetailsChoices(srv);
        drawPopup(buf, " Connection Details ", buildDetailsLines(srv), choices, detailsSelectedIndex, null, false, cols - 6);
      }

      buf.write(ansi.hideCursor());
      buf.flush();
    };

    // ── Details popup helpers ─────────────────────────────────────────────────
    function buildDetailsChoices(srv: (typeof filtered)[number]) {
      const choices = ["Connect"];
      if (srv.usePassword) {
        choices.push(showPassword ? "Hide password" : "Show password");
        choices.push(passwordCopied ? "Password copied" : "Copy password to clipboard");
      }
      choices.push("Edit", "Delete", "Close");
      return choices;
    }
    function buildDetailsLines(srv: (typeof filtered)[number]) {
      const passwordDisplay = srv.usePassword
        ? (showPassword ? srv.password : "********")
        : colors.dim("(Using Key)");
      const keyDisplay = srv.usePassword === false ? srv.privateKey : colors.dim("(Using Password)");
      return [
        `${colors.dim("Server Name:")} ${colors.yellow(srv.name)}`,
        `${colors.dim("Username:   ")} ${colors.cyan(srv.username)}`,
        srv.usePassword
          ? `${colors.dim("Password:   ")} ${passwordDisplay}`
          : `${colors.dim("Key Path:   ")} ${keyDisplay}`,
        `${colors.dim("Hostname:   ")} ${colors.blue(srv.host)}`,
        `${colors.dim("Port:       ")} ${colors.magenta(String(srv.port))}`,
        "",
        colors.dim("Actions:"),
      ];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Screen cleanup
    // ─────────────────────────────────────────────────────────────────────────

    const cleanupScreen = () => {
      process.stdout.removeListener("resize", resizeHandler);
      cleanup();
      process.stdout.write(ansi.showCursor() + ansi.clear() + ansi.moveTo(1, 1));
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Import: attempt to read + validate the selected file
    // ─────────────────────────────────────────────────────────────────────────

    const attemptImport = (pwd?: string) => {
      readConfigFile<server[]>(importSelectedFile, pwd)
        .then((content) => {
          if (!validateServers(content)) {
            importResultSuccess = false;
            importResultMessage = "The selected file is not a valid config file.";
            importStep          = "result";
            render(true);
            return;
          }
          importedServers = content;

          const newNames      = importedServers.map((s) => normalizeServerName(s.name));
          const hasConflict   = config.servers.some((s) =>
            newNames.includes(normalizeServerName(s.name)),
          );

          if (hasConflict) {
            importStep          = "conflict_choice";
            popupSelectedIndex  = 0;
            render(true);
          } else {
            config.servers = [...config.servers, ...importedServers];
            saveFile(`${CONFIG_DIR}/config.json`, config, undefined, true)
              .then(() => {
                importResultSuccess = true;
                importResultMessage = `Successfully imported ${importedServers.length} server(s).`;
                importStep          = "result";
                render(true);
              })
              .catch((err) => {
                importResultSuccess = false;
                importResultMessage = "Error saving: " + err.message;
                importStep          = "result";
                render(true);
              });
          }
        })
        .catch((err) => {
          if (err.code === "ERR_ENCRYPTED_FILE") {
            // File is encrypted — show password step with a hint
            importPasswordError  = "This file is encrypted. Enter the password.";
            importPasswordInput  = "";
            importPasswordCursor = 0;
            if (importStep !== "password") {
              importStep         = "password";
              importPasswordError = "";
              render(true);
            } else {
              render(false, true);
            }
          } else if (err.code === "ERR_INVALID_PASSWORD") {
            importPasswordError  = "Invalid password. Please try again.";
            importPasswordInput  = "";
            importPasswordCursor = 0;
            render(false, true);
          } else {
            importResultSuccess = false;
            importResultMessage = err.message ?? "Unknown error.";
            importStep          = "result";
            render(true);
          }
        });
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Key handler
    // ─────────────────────────────────────────────────────────────────────────

    const { stdin, cleanup } = setupInput((key, char) => {

      // ════════════════════════════════════════════════════════════════════════
      // EXPORT PROMPT
      // ════════════════════════════════════════════════════════════════════════
      if (showExportPrompt) {

        // ── abort confirm ─────────────────────────────────────────────────────
        if (exportStep === "abort_confirm") {
          if (key === "left" || key === "right" || key === "tab") {
            exportAbortIndex = exportAbortIndex === 0 ? 1 : 0;
            render(false, true);
          } else if (key === "enter") {
            if (exportAbortIndex === 1) { showExportPrompt = false; render(true); }
            else                        { exportStep = exportAbortReturnStep; render(true); }
          } else if (key === "ctrl-c") { cleanupScreen(); resolve(["exit", []]); }
          return;
        }

        // ── result ────────────────────────────────────────────────────────────
        if (exportStep === "result") {
          if (key === "enter" || key === "escape") { showExportPrompt = false; render(true); }
          else if (key === "ctrl-c") { cleanupScreen(); resolve(["exit", []]); }
          return;
        }

        // ── filename ──────────────────────────────────────────────────────────
        if (exportStep === "filename") {
          if (key === "escape") { showExportPrompt = false; render(true); return; }

          if (key === "backspace") {
            if (exportFilenameCursor > 0) {
              exportFilenameInput  = exportFilenameInput.slice(0, exportFilenameCursor - 1) + exportFilenameInput.slice(exportFilenameCursor);
              exportFilenameCursor--;
              exportPasswordError  = "";
              render(false, true);
            }
            return;
          }
          if (key === "left")  { if (exportFilenameCursor > 0)                    { exportFilenameCursor--; render(false, true); } return; }
          if (key === "right") { if (exportFilenameCursor < exportFilenameInput.length) { exportFilenameCursor++; render(false, true); } return; }
          if (key === "char" && char) {
            exportFilenameInput  = exportFilenameInput.slice(0, exportFilenameCursor) + char + exportFilenameInput.slice(exportFilenameCursor);
            exportFilenameCursor += char.length;
            exportPasswordError  = "";
            render(false, true);
            return;
          }
          if (key === "enter") {
            if (!exportFilenameInput.trim()) { exportPasswordError = "Filename cannot be empty."; render(false, true); return; }
            exportStep           = "password";
            exportPasswordInput  = "";
            exportPasswordCursor = 0;
            exportPasswordError  = "";
            render(true);
          } else if (key === "ctrl-c") { cleanupScreen(); resolve(["exit", []]); }
          return;
        }

        // ── password ──────────────────────────────────────────────────────────
        if (exportStep === "password") {
          if (key === "escape") {
            exportAbortReturnStep = "password";
            exportAbortIndex      = 0;
            exportStep            = "abort_confirm";
            render(true);
            return;
          }
          if (key === "backspace") {
            if (exportPasswordCursor > 0) {
              exportPasswordInput  = exportPasswordInput.slice(0, exportPasswordCursor - 1) + exportPasswordInput.slice(exportPasswordCursor);
              exportPasswordCursor--;
              render(false, true);
            }
            return;
          }
          if (key === "left")  { if (exportPasswordCursor > 0)                    { exportPasswordCursor--; render(false, true); } return; }
          if (key === "right") { if (exportPasswordCursor < exportPasswordInput.length) { exportPasswordCursor++; render(false, true); } return; }
          if (key === "char" && char) {
            exportPasswordInput  = exportPasswordInput.slice(0, exportPasswordCursor) + char + exportPasswordInput.slice(exportPasswordCursor);
            exportPasswordCursor += char.length;
            render(false, true);
            return;
          }
          if (key === "enter") {
            exportStep           = "confirm_password";
            exportConfirmInput   = "";
            exportPasswordCursor = 0;
            exportPasswordError  = "";
            render(true);
          } else if (key === "ctrl-c") { cleanupScreen(); resolve(["exit", []]); }
          return;
        }

        // ── confirm_password ─────────────────────────────────────────────────
        if (exportStep === "confirm_password") {
          if (key === "escape") {
            exportAbortReturnStep = "confirm_password";
            exportAbortIndex      = 0;
            exportStep            = "abort_confirm";
            render(true);
            return;
          }
          if (key === "backspace") {
            if (exportPasswordCursor > 0) {
              exportConfirmInput   = exportConfirmInput.slice(0, exportPasswordCursor - 1) + exportConfirmInput.slice(exportPasswordCursor);
              exportPasswordCursor--;
              exportPasswordError  = "";
              render(false, true);
            }
            return;
          }
          if (key === "left")  { if (exportPasswordCursor > 0)                  { exportPasswordCursor--; render(false, true); } return; }
          if (key === "right") { if (exportPasswordCursor < exportConfirmInput.length) { exportPasswordCursor++; render(false, true); } return; }
          if (key === "char" && char) {
            exportConfirmInput   = exportConfirmInput.slice(0, exportPasswordCursor) + char + exportConfirmInput.slice(exportPasswordCursor);
            exportPasswordCursor += char.length;
            exportPasswordError  = "";
            render(false, true);
            return;
          }
          if (key === "enter") {
            if (exportPasswordInput !== exportConfirmInput) {
              exportPasswordError = "Passwords do not match.";
              exportConfirmInput  = "";
              exportPasswordCursor = 0;
              render(false, true);
              return;
            }
            const password   = exportPasswordInput;
            const exportData = password.length > 0
              ? encryptWithPassword(JSON.stringify(exportServersToExport), password)
              : exportServersToExport;
            saveFile(exportFilenameInput, exportData)
              .then(() => {
                exportResultSuccess = true;
                exportResultMessage = `Exported ${exportServersToExport.length} server(s) to ${exportFilenameInput}.`;
                exportStep          = "result";
                render(true);
              })
              .catch((err) => {
                exportResultSuccess = false;
                exportResultMessage = err.message ?? "Unknown error.";
                exportStep          = "result";
                render(true);
              });
          } else if (key === "ctrl-c") { cleanupScreen(); resolve(["exit", []]); }
          return;
        }

        if (key === "ctrl-c") { cleanupScreen(); resolve(["exit", []]); }
        return;
      }

      // ════════════════════════════════════════════════════════════════════════
      // IMPORT PROMPT
      // ════════════════════════════════════════════════════════════════════════
      if (showImportPrompt) {

        // ── abort confirm ─────────────────────────────────────────────────────
        if (importStep === "abort_confirm") {
          if (key === "left" || key === "right" || key === "tab") {
            importAbortIndex = importAbortIndex === 0 ? 1 : 0;
            render(false, true);
          } else if (key === "enter") {
            if (importAbortIndex === 1) { showImportPrompt = false; render(true); }
            else                        { importStep = importAbortReturnStep; render(true); }
          } else if (key === "ctrl-c") { cleanupScreen(); resolve(["exit", []]); }
          return;
        }

        // ── result ────────────────────────────────────────────────────────────
        if (importStep === "result") {
          if (key === "enter" || key === "escape") {
            showImportPrompt = false;
            if (importResultSuccess) { servers = config.servers; filtered = getFiltered(); }
            render(true);
          } else if (key === "ctrl-c") { cleanupScreen(); resolve(["exit", []]); }
          return;
        }

        // ── file browser ──────────────────────────────────────────────────────
        if (importStep === "file_browser") {
          if (key === "escape") { showImportPrompt = false; render(true); return; }

          if (key === "up") {
            if (importBrowserSelected > 0) {
              importBrowserSelected--;
              if (importBrowserSelected < importBrowserOffset)
                importBrowserOffset = importBrowserSelected;
              render(false, true);
            }
            return;
          }
          if (key === "down") {
            if (importBrowserSelected < importEntries.length - 1) {
              importBrowserSelected++;
              const vc = visibleBrowserCount(getTermSize().rows);
              if (importBrowserSelected >= importBrowserOffset + vc)
                importBrowserOffset = importBrowserSelected - vc + 1;
              render(false, true);
            }
            return;
          }
          if (key === "enter") {
            const entry = importEntries[importBrowserSelected];
            if (!entry) return;
            if (entry.isDir) {
              const newPath         = entry.name === ".."
                ? path.dirname(importBrowserPath)
                : path.join(importBrowserPath, entry.name);
              importBrowserPath     = newPath;
              importEntries         = loadBrowserEntries(newPath);
              importBrowserOffset   = 0;
              importBrowserSelected = 0;
              render(false, true);
            } else {
              importSelectedFile   = path.join(importBrowserPath, entry.name);
              importPasswordInput  = "";
              importPasswordCursor = 0;
              importPasswordError  = "";
              importStep           = "password";
              render(true);
            }
          } else if (key === "ctrl-c") { cleanupScreen(); resolve(["exit", []]); }
          return;
        }

        // ── password ──────────────────────────────────────────────────────────
        if (importStep === "password") {
          if (key === "escape") {
            importAbortReturnStep = "password";
            importAbortIndex      = 0;
            importStep            = "abort_confirm";
            render(true);
            return;
          }
          if (key === "backspace") {
            if (importPasswordCursor > 0) {
              importPasswordInput  = importPasswordInput.slice(0, importPasswordCursor - 1) + importPasswordInput.slice(importPasswordCursor);
              importPasswordCursor--;
              importPasswordError  = "";
              render(false, true);
            }
            return;
          }
          if (key === "left")  { if (importPasswordCursor > 0)                    { importPasswordCursor--; render(false, true); } return; }
          if (key === "right") { if (importPasswordCursor < importPasswordInput.length) { importPasswordCursor++; render(false, true); } return; }
          if (key === "char" && char) {
            importPasswordInput  = importPasswordInput.slice(0, importPasswordCursor) + char + importPasswordInput.slice(importPasswordCursor);
            importPasswordCursor += char.length;
            importPasswordError  = "";
            render(false, true);
            return;
          }
          if (key === "enter") {
            const pwd = importPasswordInput.length > 0 ? importPasswordInput : undefined;
            attemptImport(pwd);
          } else if (key === "ctrl-c") { cleanupScreen(); resolve(["exit", []]); }
          return;
        }

        // ── conflict choice ───────────────────────────────────────────────────
        if (importStep === "conflict_choice") {
          if (key === "escape") {
            importAbortReturnStep = "conflict_choice";
            importAbortIndex      = 0;
            importStep            = "abort_confirm";
            render(true);
            return;
          }
          if (key === "left" || key === "up") {
            popupSelectedIndex = (popupSelectedIndex - 1 + 3) % 3;
            render(false, true);
          } else if (key === "right" || key === "down" || key === "tab") {
            popupSelectedIndex = (popupSelectedIndex + 1) % 3;
            render(false, true);
          } else if (key === "enter") {
            if (popupSelectedIndex === 2) { showImportPrompt = false; render(true); }
            else {
              const overwrite  = popupSelectedIndex === 0;
              const newNames   = importedServers.map((s) => normalizeServerName(s.name));
              let updated: server[];
              if (overwrite) {
                updated = [
                  ...config.servers.filter((s) => !newNames.includes(normalizeServerName(s.name))),
                  ...importedServers,
                ];
              } else {
                const existing = config.servers.map((s) => normalizeServerName(s.name));
                updated = [
                  ...config.servers,
                  ...importedServers.filter((s) => !existing.includes(normalizeServerName(s.name))),
                ];
              }
              config.servers = updated;
              saveFile(`${CONFIG_DIR}/config.json`, config, undefined, true)
                .then(() => {
                  importResultSuccess = true;
                  importResultMessage = `Successfully imported ${importedServers.length} server(s).`;
                  importStep          = "result";
                  render(true);
                })
                .catch((err) => {
                  importResultSuccess = false;
                  importResultMessage = "Error saving: " + err.message;
                  importStep          = "result";
                  render(true);
                });
            }
          } else if (key === "ctrl-c") { cleanupScreen(); resolve(["exit", []]); }
          return;
        }

        if (key === "ctrl-c") { cleanupScreen(); resolve(["exit", []]); }
        return;
      }

      // ════════════════════════════════════════════════════════════════════════
      // DELETE CONFIRM
      // ════════════════════════════════════════════════════════════════════════
      if (showDeleteConfirm) {
        if (key === "left" || key === "right" || key === "up" || key === "down" || key === "tab") {
          popupSelectedIndex = popupSelectedIndex === 0 ? 1 : 0;
          render(false, true);
        } else if (key === "enter") {
          if (popupSelectedIndex === 0) {
            let indicesToRemove: number | number[];
            if (selectedIndices.size > 0) { indicesToRemove = Array.from(selectedIndices); }
            else                          { indicesToRemove = filtered[selectedIndex].originalIndex; }
            performDelete(config, indicesToRemove).then((newConfig) => {
              config         = newConfig;
              servers        = config.servers;
              searchInput    = "";
              filtered       = getFiltered();
              showDeleteConfirm = false;
              selectedIndices.clear();
              selectedIndex  = 0;
              render();
            });
          } else {
            showDeleteConfirm = false;
            render();
          }
        } else if (key === "escape") {
          showDeleteConfirm = false;
          render();
        } else if (key === "ctrl-c") { cleanupScreen(); resolve(["exit", []]); }
        return;
      }

      // ════════════════════════════════════════════════════════════════════════
      // DETAILS POPUP
      // ════════════════════════════════════════════════════════════════════════
      if (showDetailsPopup) {
        const srv     = filtered[selectedIndex];
        const choices = buildDetailsChoices(srv);

        if (key === "up") {
          detailsSelectedIndex = (detailsSelectedIndex - 1 + choices.length) % choices.length;
          render(false, true);
        } else if (key === "down" || key === "tab") {
          detailsSelectedIndex = (detailsSelectedIndex + 1) % choices.length;
          render(false, true);
        } else if (key === "escape") {
          showDetailsPopup = false;
          render();
        } else if (key === "enter") {
          const action = choices[detailsSelectedIndex];
          if (action === "Connect") {
            cleanupScreen();
            resolve(["ssh-connect", [JSON.stringify(srv), "false"]]);
          } else if (action === "Show password" || action === "Hide password") {
            showPassword = !showPassword;
            render(false, true);
          } else if (action === "Copy password to clipboard" || action === "Password copied") {
            if (srv.usePassword) { clipboard.writeSync(srv.password); passwordCopied = true; render(false, true); }
          } else if (action === "Edit") {
            cleanupScreen();
            resolve(["ssh-edit", [JSON.stringify(srv), String(srv.originalIndex)]]);
          } else if (action === "Delete") {
            showDetailsPopup  = false;
            showDeleteConfirm = true;
            popupSelectedIndex = 1;
            render();
          } else if (action === "Close") {
            showDetailsPopup = false;
            render();
          }
        } else if (key === "ctrl-c") { cleanupScreen(); resolve(["exit", []]); }
        return;
      }

      // ════════════════════════════════════════════════════════════════════════
      // GLOBAL (list navigation, search, shortcuts)
      // ════════════════════════════════════════════════════════════════════════

      if (key === "ctrl-space") {
        if (filtered.length > 0) {
          const srv = filtered[selectedIndex];
          if (selectedIndices.has(srv.originalIndex)) selectedIndices.delete(srv.originalIndex);
          else                                         selectedIndices.add(srv.originalIndex);
          render();
        }
        return;
      }

      if (key === "ctrl-e") {
        if (filtered.length > 0) {
          exportServersToExport  = selectedIndices.size > 0
            ? config.servers.filter((_, idx) => selectedIndices.has(idx))
            : [filtered[selectedIndex]];
          const now = new Date();
          const ts  = now.toISOString().slice(0, 19).replace("T", "---").replace(/:/g, "-");
          exportFilenameInput    = `config-export-${ts}.cfg`;
          exportFilenameCursor   = exportFilenameInput.length;
          exportStep             = "filename";
          exportPasswordInput    = "";
          exportConfirmInput     = "";
          exportPasswordCursor   = 0;
          exportPasswordError    = "";
          exportResultSuccess    = false;
          exportResultMessage    = "";
          showExportPrompt       = true;
          render(true);
        }
        return;
      }

      if (key === "ctrl-o") {
        importBrowserPath      = process.cwd();
        importEntries          = loadBrowserEntries(importBrowserPath);
        importBrowserOffset    = 0;
        importBrowserSelected  = 0;
        importSelectedFile     = "";
        importPasswordInput    = "";
        importPasswordCursor   = 0;
        importPasswordError    = "";
        importedServers        = [];
        importStep             = "file_browser";
        importResultSuccess    = false;
        importResultMessage    = "";
        showImportPrompt       = true;
        render(true);
        return;
      }

      if (key === "shift-tab" && !showDeleteConfirm && !showImportPrompt) {
        footerOffset++;
        render();
        return;
      }

      if (key === "escape") {
        if (searchInput.length > 0 || selectedIndices.size > 0) {
          if (searchInput.length > 0) { searchInput = ""; cursorPos = 0; filtered = getFiltered(); selectedIndex = 0; }
          else                         { selectedIndices.clear(); }
          render();
        } else {
          cleanupScreen();
          resolve(["main", []]);
        }
        return;
      }

      if (key === "ctrl-delete") {
        if (filtered.length > 0) { showDeleteConfirm = true; popupSelectedIndex = 1; render(); }
        return;
      }

      if (key === "backspace") {
        if (cursorPos > 0) { searchInput = searchInput.slice(0, cursorPos - 1) + searchInput.slice(cursorPos); cursorPos--; filtered = getFiltered(); selectedIndex = 0; render(); }
        return;
      }
      if (key === "left")  { if (cursorPos > 0)               { cursorPos--; render(); } return; }
      if (key === "right") { if (cursorPos < searchInput.length) { cursorPos++; render(); } return; }

      if (key === "char" && char) {
        searchInput = searchInput.slice(0, cursorPos) + char + searchInput.slice(cursorPos);
        cursorPos  += char.length;
        filtered    = getFiltered();
        selectedIndex = 0;
        render();
        return;
      }

      if (key === "up") {
        if (filtered.length > 0) { selectedIndex--; if (selectedIndex < 0) selectedIndex = filtered.length - 1; }
        render();
        return;
      }
      if (key === "down") {
        if (filtered.length > 0) { selectedIndex++; if (selectedIndex >= filtered.length) selectedIndex = 0; }
        render();
        return;
      }

      if (key === "enter") {
        if (filtered.length > 0) { showDetailsPopup = true; detailsSelectedIndex = 0; showPassword = false; passwordCopied = false; render(); }
        return;
      }

      if (key === "ctrl-c") { cleanupScreen(); resolve(["exit", []]); }
    });

    const resizeHandler = () => render(true);
    process.stdout.on("resize", resizeHandler);
    render(true);
  });
}
