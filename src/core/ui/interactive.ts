import goodbye from "../../utils/goodbye";
import { config, log, menu } from "../../utils/types";
import deleteConnection from "./connections/delete";
import editConnection from "./connections/edit";
import listConnections from "./connections/list";
import mainMenu from "./mainMenu";
import newConnection from "./connections/new";
import sshConnect from "../functions/sshConnect";
import { Command } from "commander";
import manual from "./manual";
import settings from "./settings/settings";
import editDefault from "./settings/editDefault";
import displayLogs from "./logs";
import exportConnections from "./connections/export";
import { ansi } from "../../utils/tui/index";

async function interactive(
  initialConfig: config,
  initialLogs: log[],
  program: Command,
) {
  let currentMenu: menu = "main",
    options: string[] | null = null,
    config: config = { ...initialConfig },
    logs: log[] = [...initialLogs];

  process.stdout.write(ansi.altScreenEnter());

  while (currentMenu !== "exit") {
    if (currentMenu === "main") {
      [currentMenu, options] = await mainMenu(config.recentServers);
    }

    if (currentMenu === "ssh-new") {
      [currentMenu, options] = (await newConnection(config, logs)) as any;
    }

    if (currentMenu === "ssh-list") {
      [currentMenu, options] = await listConnections(config, options);
    }

    if (currentMenu === "ssh-connect") {
      process.stdout.write(ansi.altScreenExit());
      [currentMenu, config, logs] = await sshConnect(
        config,
        logs,
        JSON.parse(options[0]),
        options[1] === "true",
      );
      process.stdout.write(ansi.altScreenEnter());
    }

    if (currentMenu === "ssh-edit") {
      [currentMenu, options, config] = await editConnection(
        config,
        parseInt(options[1]),
        logs,
      );
    }

    if (currentMenu === "ssh-delete") {
      [currentMenu, options] = await deleteConnection(
        config,
        JSON.parse(options[0]),
        parseInt(options[1]),
      );
    }

    if (currentMenu === "ssh-export") {
      [currentMenu, options] = await exportConnections(config.servers);
    }

    if (currentMenu === "manual") {
      [currentMenu] = await manual(program);
    }

    if (currentMenu === "settings") {
      [currentMenu, options] = await settings(config);
    }

    if (currentMenu === "settings-defaults-edit") {
      [currentMenu, config] = await editDefault(JSON.parse(options[0]), config);
    }

    if (currentMenu === "logs") {
      [currentMenu] = await displayLogs(logs);
    }
  }

  process.stdout.write(ansi.altScreenExit());
  goodbye();
}

export default interactive;
