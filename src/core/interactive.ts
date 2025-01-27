import goodbye from "../utils/goodbye";
import { config, log, menu } from "../utils/types";
import displayConnection from "./displayConnection";
import editConnection from "./editConnection";
import listConnections from "./listConnections";
import mainMenu from "./mainMenu";
import newConnection from "./newConnection";
import searchConnections from "./searchConnections";
import sshConnect from "./sshConnect";

async function interactive(initialConfig: config, initialLogs: log[]) {
  let currentMenu: menu = "main",
    options: string[] | null = null,
    config: config = { ...initialConfig },
    logs: log[] = [...initialLogs];

  while (currentMenu !== "exit") {
    if (currentMenu === "main") {
      [currentMenu, options] = await mainMenu(config.recentServers);
    }

    if (currentMenu === "ssh-new") {
      [currentMenu, config, logs] = await newConnection(config, logs);
    }

    if (currentMenu === "ssh-list") {
      [currentMenu, options] = await listConnections(config.servers);
    }

    if (currentMenu === "ssh-search") {
      [currentMenu, options] = await searchConnections(config.servers);
    }

    if (currentMenu === "ssh-display") {
      [currentMenu, options] = await displayConnection(
        JSON.parse(options[0]),
        parseInt(options[1])
      );
    }

    if (currentMenu === "ssh-connect") {
      [currentMenu, config, logs] = await sshConnect(
        config,
        logs,
        JSON.parse(options[0])
      );
      console.clear();
    }

    if (currentMenu === "ssh-edit") {
      [currentMenu, options, config] = await editConnection(
        config,
        parseInt(options[1]),
        logs
      );
    }
  }

  goodbye();
}

export default interactive;
