import goodbye from "../utils/goodbye";
import { menu } from "../utils/types";
import mainMenu from "./mainMenu";
import newConnection from "./newConnection";

async function interactive() {
  let currentMenu: menu = "main";

  while (currentMenu !== "exit") {
    if (currentMenu === "main") {
      currentMenu = await mainMenu();
    }

    if (currentMenu === "ssh-connect") {
      currentMenu = await newConnection();
    }
  }

  goodbye();
}

export default interactive;
