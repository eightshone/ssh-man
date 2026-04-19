import { menu } from "../../utils/types";
import { setupInput } from "../../utils/tui/input";
import {
  ansi,
  ScreenBuffer,
  drawBox,
  getTermSize,
  drawPopup,
  padOrTruncate,
  drawFooter,
} from "../../utils/tui/index";

export default function errorPopup(
  message: string,
  returnMenu: menu,
): Promise<[menu]> {
  return new Promise((resolve) => {
    const render = () => {
      const { rows, cols } = getTermSize();
      const buf = new ScreenBuffer();

      buf.write(ansi.hideCursor());
      buf.write(ansi.clear());
      drawBox(buf, 1, 1, cols, rows - 1, "rounded");
      buf.moveTo(1, 3).write(ansi.fg("160", " Error "));

      const keybindings = [
        { action: "Close", key: "<enter>" },
        { action: "Close", key: "<esc>" },
      ];
      drawFooter(buf, cols, rows, keybindings, 0);

      const lines = ["Connection attempt failed:", `${message}`];

      drawPopup(
        buf,
        " Connection Failed ",
        lines,
        ["Close"],
        0,
        "160", // Red
      );

      buf.flush();
    };

    const { stdin, cleanup } = setupInput((key) => {
      if (
        key === "enter" ||
        key === "escape" ||
        key === "ctrl-c" ||
        key === "space"
      ) {
        cleanup();
        resolve([returnMenu]);
      }
    });

    const resizeHandler = () => render();
    process.stdout.on("resize", resizeHandler);

    render();
  });
}
