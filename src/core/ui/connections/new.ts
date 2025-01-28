import select from "@inquirer/select";

import promptSSHConfig from "../promptSSHConfig";
import { config, log, menu } from "../../../utils/types";
import sshConnection from "../../functions/ssh";
import updateConfigs from "../../../utils/updateConfigs";

async function newConnection(
  initialConfig: config,
  initialLogs: log[]
): Promise<[menu, config, log[]]> {
  let config: config = { ...initialConfig };
  let logs: log[] = [...initialLogs];
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
    const sshConfig = await promptSSHConfig(saveConnection, config.servers);
    if (saveConnection) {
      // save new server config to the list of configs
      [config, logs] = await updateConfigs(
        config,
        logs,
        sshConfig,
        saveConnection
      );
    }
    console.clear();
    await sshConnection(sshConfig);
  }

  return ["main", config, logs];
}

export default newConnection;
