import fs from "fs";
import { config, menu } from "../../../utils/types";
import { setupInput } from "../../../utils/tui/input";
import {
  ansi,
  ScreenBuffer,
  drawBox,
  padOrTruncate,
  getTermSize,
  drawFooter,
  drawPopup,
} from "../../../utils/tui/index";
import stringPadding from "../../../utils/stringPadding";
import saveFile from "../../../utils/saveFile";
import { CONFIG_DIR } from "../../../utils/consts";

type SettingsMode = "list" | "edit_port" | "edit_key" | "edit_prefix";

export default function settings(
  initialConfig: config,
): Promise<[menu, string[], config]> {
  return new Promise((resolve) => {
    let activeConfig = { ...initialConfig };
    let mode: SettingsMode = "list";
    let selectedIndex = 0;
    let footerOffset = 0;

    let inputValue = "";
    let cursorPosition = 0;
    let errorMessage = "";

    const items = [
      { id: "port", label: "Port", selectable: true },
      { id: "key", label: "Private key path", selectable: true },
      { id: "prefix", label: "Autosave prefix", selectable: true },
      { id: "sep1", label: "Security", selectable: false },
      {
        id: "sec_info",
        label: "  Security features will be introduced in future versions.",
        selectable: false,
      },
      { id: "sep2", label: "Backups", selectable: false },
      {
        id: "bak_info",
        label: "  Backups will be supported in future versions.",
        selectable: false,
      },
      { id: "sep3", label: "", selectable: false },
    ];

    const getPopupDetails = () => {
      switch (mode) {
        case "edit_port":
          return {
            title: " Edit Default Port ",
            placeholder: String(activeConfig.defaults.port),
          };
        case "edit_key":
          return {
            title: " Edit Private Key Path ",
            placeholder: activeConfig.defaults.privateKey || "",
          };
        case "edit_prefix":
          return {
            title: " Edit Autosave Prefix ",
            placeholder: activeConfig.defaults.autoSavePrefix || "",
          };
        default:
          return { title: "", placeholder: "" };
      }
    };

    const render = (fullRender: boolean = false) => {
      const { rows, cols } = getTermSize();
      const buf = new ScreenBuffer();

      if (fullRender) {
        buf.write(ansi.clear());
      }

      drawBox(buf, 1, 1, cols, rows - 1, "rounded");
      buf.moveTo(1, 4).write(ansi.fg("255", " Settings "));

      let keybindings: { action: string; key: string }[] = [];
      if (mode === "list") {
        keybindings = [
          { action: "Navigate", key: "↑ ↓" },
          { action: "Edit/Select", key: "<enter>" },
          { action: "Back", key: "<esc>" }
        ];
      } else {
        keybindings = [
          { action: "Type", key: "chars" },
          { action: "Cursor", key: "← →" },
          { action: "Accept", key: "<enter>" },
          { action: "Cancel", key: "<esc>" }
        ];
      }
      drawFooter(buf, cols, rows, keybindings, footerOffset);

      const listTop = 3;
      const maxColWidth = cols - 4;
      const columnWidth = Math.floor(maxColWidth / 2);

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        let displayStr = "";

        if (item.id === "port" || item.id === "key" || item.id === "prefix") {
          let val = "";
          if (item.id === "port") val = String(activeConfig.defaults.port);
          if (item.id === "key") val = activeConfig.defaults.privateKey;
          if (item.id === "prefix") val = activeConfig.defaults.autoSavePrefix;

          displayStr = `${stringPadding("  " + item.label, columnWidth - 1)} ${stringPadding(val, columnWidth, "start")}`;
        } else if (item.id.startsWith("sep") && item.label) {
          displayStr = `  ${ansi.dim(item.label)}`;
        } else {
          displayStr = `  ${item.label}`;
          if (!item.selectable && item.id.includes("_info")) {
            displayStr = ansi.dim(displayStr);
          }
        }

        displayStr = padOrTruncate(displayStr, maxColWidth);

        const isSelected =
          i === selectedIndex && item.selectable && mode === "list";
        if (isSelected) {
          buf.moveTo(listTop + i, 2).write(`${ansi.bg(238, displayStr)}`);
        } else {
          buf.moveTo(listTop + i, 2).write(displayStr);
        }
      }

      if (mode !== "list") {
        const { title, placeholder } = getPopupDetails();

        let displayInput = inputValue;
        if (inputValue.length === 0 && placeholder) {
          displayInput = ansi.dim(placeholder);
          const cursorBlock = ansi.bg("240", " ");
          displayInput += cursorBlock;
        } else {
          const part1 = inputValue.slice(0, cursorPosition);
          const charAtCursor = inputValue[cursorPosition] || " ";
          const part2 = inputValue.slice(cursorPosition + 1);
          displayInput = `${part1}${ansi.bg("240", charAtCursor)}${part2}`;
        }

        const lines = ["", `  > ${displayInput}`, ""];
        if (errorMessage) {
          lines.push(ansi.fg("160", `  ${errorMessage}`));
          lines.push("");
        }

        drawPopup(buf, title, lines, [], 0, "255", false);
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

    const saveSettings = async () => {
      await saveFile(
        `${CONFIG_DIR}/config.json`,
        activeConfig,
        undefined,
        true,
      );
    };

    const { stdin, cleanup } = setupInput((key, char) => {
      if (mode === "list") {
        if (key === "escape") {
          cleanupScreen();
          resolve(["main", [], activeConfig]);
          return;
        }

        if (key === "ctrl-c") {
          cleanupScreen();
          resolve(["exit", [], activeConfig]);
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
          const item = items[selectedIndex];

          if (item.id === "port") mode = "edit_port";
          else if (item.id === "key") mode = "edit_key";
          else if (item.id === "prefix") mode = "edit_prefix";

          if (mode !== "list") {
            inputValue = "";
            cursorPosition = 0;
            errorMessage = "";
            render(true);
          }
          return;
        }

        if (key === "shift-tab") {
          footerOffset++;
          render();
          return;
        }
      } else {
        // Popup input mode
        if (key === "escape") {
          mode = "list";
          render(true);
          return;
        }
        
        if (key === "ctrl-c") {
          cleanupScreen();
          resolve(["exit", [], activeConfig]);
          return;
        }

        if (key === "backspace") {
          if (cursorPosition > 0) {
            inputValue =
              inputValue.slice(0, cursorPosition - 1) +
              inputValue.slice(cursorPosition);
            cursorPosition--;
            errorMessage = "";
            render();
          }
          return;
        }

        if (key === "left") {
          if (cursorPosition > 0) {
            cursorPosition--;
            render();
          }
          return;
        }

        if (key === "right") {
          if (cursorPosition < inputValue.length) {
            cursorPosition++;
            render();
          }
          return;
        }

        if (key === "char" && char) {
          inputValue =
            inputValue.slice(0, cursorPosition) +
            char +
            inputValue.slice(cursorPosition);
          cursorPosition += char.length;
          errorMessage = "";
          render();
          return;
        }

        if (key === "enter") {
          const trimmed = inputValue.trim();

          // Empty means exit without changing
          if (trimmed.length === 0) {
            mode = "list";
            render(true);
            return;
          }

          let isValid = true;
          if (mode === "edit_port") {
            const pnum = parseInt(trimmed, 10);
            if (isNaN(pnum) || pnum === 0) {
              errorMessage = "Port must be a non-zero number.";
              isValid = false;
            } else {
              activeConfig.defaults.port = pnum;
            }
          } else if (mode === "edit_key") {
            try {
              if (!fs.existsSync(trimmed) || !fs.statSync(trimmed).isFile()) {
                errorMessage =
                  "Private key path must lead to an existing file.";
                isValid = false;
              } else {
                activeConfig.defaults.privateKey = trimmed;
              }
            } catch (e) {
              errorMessage = "Private key path is invalid.";
              isValid = false;
            }
          } else if (mode === "edit_prefix") {
            if (!/^[a-zA-Z0-9-_\s]+$/.test(trimmed)) {
              errorMessage =
                "Prefix must contain only alphanumeric, dash, underscore, space.";
              isValid = false;
            } else {
              activeConfig.defaults.autoSavePrefix = trimmed;
            }
          }

          if (isValid) {
            saveSettings().then(() => {
              mode = "list";
              render(true);
            });
          } else {
            render();
          }
          return;
        }

        if (key === "shift-tab") {
          footerOffset++;
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
