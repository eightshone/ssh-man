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
} from "../../utils/tui/index";

type MenuItem = {
  name: string;
  value: menu | null;
  selectable: boolean;
  options?: string[];
  muted?: boolean;
};

const ASCII_ART = [
  " ███████╗███████╗██╗  ██╗███╗   ███╗ █████╗ ███╗   ██╗",
  " ██╔════╝██╔════╝██║  ██║████╗ ████║██╔══██╗████╗  ██║",
  " ███████╗███████╗███████║██╔████╔██║███████║██╔██╗ ██║",
  " ╚════██║╚════██║██╔══██║██║╚██╔╝██║██╔══██║██║╚██╗██║",
  " ███████║███████║██║  ██║██║ ╚═╝ ██║██║  ██║██║ ╚████║",
  " ╚══════╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝",
];

export default function mainMenu(
  recentServers: server[] = [],
): Promise<[menu, string[] | null]> {
  return new Promise((resolve) => {
    let items: MenuItem[] = [
      {
        name: "Recent sessions",
        value: null,
        selectable: false,
        muted: true,
      },
    ];

    if (recentServers.length > 0) {
      recentServers.slice(0, 3).forEach((srv, idx) => {
        items.push({
          name: `   ${idx + 1} - ${srv.name}`,
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
      name: "Saved servers",
      value: "ssh-list",
      selectable: true,
    });
    items.push({ name: "", value: null, selectable: false });
    items.push({ name: "Settings", value: "settings", selectable: true });
    items.push({
      name: "Logs [Exiperimental]",
      value: "logs",
      selectable: true,
    });
    items.push({ name: "Manual", value: "manual", selectable: true });
    items.push({ name: "Quit", value: "exit", selectable: true });

    let selectedIndex = items.findIndex((i) => i.selectable);
    if (selectedIndex === -1) selectedIndex = 0;

    const render = (fullRender: boolean = false) => {
      const { rows, cols } = getTermSize();
      const buf = new ScreenBuffer();

      // Calculate vertical centering bounds
      const totalContentHeight = ASCII_ART.length + 2 + items.length;
      const availableInnerRows = rows - 3;
      let startRow = 3;
      if (availableInnerRows > totalContentHeight) {
        startRow = 2 + Math.floor((availableInnerRows - totalContentHeight) / 2);
      }
      
      let currentLine = startRow;

      // Optional clear and static borders on init or resize
      if (fullRender) {
        buf.write(ansi.clear());
        drawBox(buf, 1, 1, cols, rows - 1, "rounded");

        for (const line of ASCII_ART) {
          writeTextCentered(buf, currentLine++, 1, cols - 2, line);
        }
        
        const footerMsg =
          " Navigate: ↑ ↓ |  Select: <enter> | Quit: <q> or <ctrl-c> ";
        buf
          .moveTo(rows, 2)
          .write(ansi.bg("236", ansi.fg("250", footerMsg)));
      } else {
        currentLine += ASCII_ART.length;
      }
      currentLine += 2;

      // Draw Menu items
      const maxListWidth = Math.min(70, cols - 4);
      const listColStart = Math.max(3, Math.floor((cols - maxListWidth) / 2));

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        let rowIdx = currentLine + i;

        if (rowIdx >= rows - 2) break; // Term is too small to show everything

        let text = padOrTruncate(item.name, maxListWidth);

        if (i === selectedIndex && item.selectable) {
          // Highlight selected
          buf
            .moveTo(rowIdx, listColStart)
            .write(`${ansi.bg(238, ansi.fg(255, text))}`);
        } else if (item.muted) {
          // Muted unselectable
          buf.moveTo(rowIdx, listColStart).write(ansi.dim(text));
        } else {
          // Normal option
          buf.moveTo(rowIdx, listColStart).write(text);
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
