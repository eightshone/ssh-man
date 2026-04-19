import { menu, server } from "../../utils/types";
import { setupInput } from "../../utils/tui/input";
import {
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
      process.stdout.removeListener("resize", resizeHandler);
      cleanup();
      process.stdout.write(
        ansi.showCursor() + ansi.clear() + ansi.moveTo(1, 1),
      );
    };

    const { stdin, cleanup } = setupInput((key, char) => {
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

    const resizeHandler = () => render(true);
    process.stdout.on("resize", resizeHandler);
    render(true);
  });
}
