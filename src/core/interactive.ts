import goodbye from "../utils/goodbye";
import { config, log, menu } from "../utils/types";
import mainMenu from "./mainMenu";
import newConnection from "./newConnection";

async function interactive(initialConfig: config, initialLogs: log[]) {
  let currentMenu: menu = "main",
    config: config = { ...initialConfig },
    logs: log[] = [...initialLogs];

  while (currentMenu !== "exit") {
    if (currentMenu === "main") {
      currentMenu = await mainMenu();
    }

    if (currentMenu === "ssh-connect") {
      [currentMenu, config, logs] = await newConnection(config, logs);
    }
  }

  goodbye();
}

export default interactive;
