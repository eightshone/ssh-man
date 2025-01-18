import select from "@inquirer/select";

import promptSSHConfig from "./promptSSHConfig";
import { config, log, menu } from "../utils/types";
import sshConnection from "./ssh";
import saveFile from "../utils/saveFile";
import { configDir } from "../utils/consts";
import updateRecentServers from "../utils/updateRecentServer";
import { formattedTime } from "../utils/time";

async function newConnection(
  config: config,
  logs: log[]
): Promise<[menu, config, log[]]> {
  const saveConnection: boolean | null = await select({
    message: "Save connection",
    choices: [
      {
        name: "✔️ YES",
        value: true,
        description: "Save this new conenction to the servers list",
      },
      {
        name: "❌ No",
        value: false,
        description: "Connect without saving",
      },
      {
        name: "↩️ Exit",
        value: null,
        description: "Exit to main menu",
      },
    ],
  });

  if (saveConnection !== null) {
    const sshConfig = await promptSSHConfig(saveConnection);
    if (saveConnection) {
      // save new server config to the list of configs
      config.servers = [...config.servers, sshConfig];
      config.recentServers = updateRecentServers(
        config.recentServers,
        sshConfig
      );
      logs = [{ time: formattedTime, server: sshConfig.name }, ...logs];
      saveFile(`${configDir}/config.json`, config);
      saveFile(`${configDir}/logs.json`, logs);
    }
    console.clear();
    await sshConnection(sshConfig);
  }

  return ["main", config, logs];
}

export default newConnection;
