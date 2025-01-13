import goodbye from "../utils/goodbye";
import { menu } from "../utils/types";
import mainMenu from "./mainMenu";

async function interactive() {
  let currentMenu: menu = "main";

  while (currentMenu !== "exit") {
    if (currentMenu === "main") {
      currentMenu = await mainMenu();
    }
  }

  goodbye();
}

export default interactive;
