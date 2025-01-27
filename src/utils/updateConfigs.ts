import { CONFIG_DIR } from "./consts";
import findServerIndex from "./findServerIndex";
import saveFile from "./saveFile";
import { formattedTime } from "./time";
import { config, log, server } from "./types";
import updateRecentServers from "./updateRecentServer";

async function updateConfigs(
  initialConfig: config,
  initialLogs: log[],
  sshConfig: server,
  saveConfig: boolean = false
): Promise<[config, log[]]> {
  const config: config = { ...initialConfig };
  let logs: log[] = [...initialLogs];

  if (saveConfig) {
    if (findServerIndex(config.servers, sshConfig) === -1) {
      config.servers = [...config.servers, sshConfig];
    } else {
      console.info(
        "\n⚠️ This server config exists in your list of servers!\n   It will not be added to the list to avoid duplicate entries.\n"
      );
    }
  }
  config.recentServers = updateRecentServers(config.recentServers, sshConfig);
  logs = [{ time: formattedTime, server: sshConfig.id }, ...logs];
  await saveFile(`${CONFIG_DIR}/config.json`, config);
  await saveFile(`${CONFIG_DIR}/logs.json`, logs);

  return [config, logs];
}

export default updateConfigs;
