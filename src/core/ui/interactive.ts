import goodbye from "../../utils/goodbye";
import { config, log, menu } from "../../utils/types";
import deleteConnection from "./connections/delete";
import displayConnection from "./connections/display";
import editConnection from "./connections/edit";
import listConnections from "./connections/list";
import mainMenu from "./mainMenu";
import newConnection from "./connections/new";
import searchConnections from "./connections/search";
import sshConnect from "../functions/sshConnect";
import { Command } from "commander";
import manual from "./manual";
import settings from "./settings/settings";

async function interactive(
  initialConfig: config,
  initialLogs: log[],
  program: Command
) {
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

    if (currentMenu === "ssh-delete") {
      [currentMenu, options] = await deleteConnection(
        config,
        JSON.parse(options[0]),
        parseInt(options[1])
      );
    }

    if (currentMenu === "manual") {
      [currentMenu] = await manual(program);
    }

    if (currentMenu === "settings") {
      [currentMenu, options] = await settings(config);
    }
  }

  goodbye();
}

export default interactive;
