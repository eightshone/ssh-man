import goodbye from "../utils/goodbye";
import { config, log, menu } from "../utils/types";
import mainMenu from "./mainMenu";
import newConnection from "./newConnection";
import quickConnect from "./quickConnect";

async function interactive(initialConfig: config, initialLogs: log[]) {
  let currentMenu: menu = "main",
    options: string[] | null = null,
    config: config = { ...initialConfig },
    logs: log[] = [...initialLogs];

  while (currentMenu !== "exit") {
    if (currentMenu === "main") {
      [currentMenu, options] = await mainMenu(config.recentServers);
    }

    if (currentMenu === "ssh-connect") {
      [currentMenu, config, logs] = await newConnection(config, logs);
    }

    if (currentMenu === "quick-connect") {
      [currentMenu, config, logs] = await quickConnect(
        config,
        logs,
        JSON.parse(options[0])
      );
    }
  }

  goodbye();
}

export default interactive;
