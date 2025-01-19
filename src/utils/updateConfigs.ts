import { configDir } from "./consts";
import findServerIndex from "./findServerIndex";
import saveFile from "./saveFile";
import { formattedTime } from "./time";
import { config, log, server } from "./types";
import updateRecentServers from "./updateRecentServer";

async function updateConfigs(
  initialConfig: config,
  initialLogs: log[],
  sshConfig: server
): Promise<[config, log[]]> {
  const config: config = { ...initialConfig };
  let logs: log[] = [...initialLogs];

  if (findServerIndex(config.servers, sshConfig) === -1) {
    config.servers = [...config.servers, sshConfig];
  } else {
    console.info(
      "+----------------------------------------------------------------+"
    );
    console.info(
      "|⚠️ This server config exists in your list of servers!           |"
    );
    console.info(
      "|   It will not be added to the list to avoid duplicate entries. |"
    );
    console.info(
      "+----------------------------------------------------------------+"
    );
  }
  config.recentServers = updateRecentServers(config.recentServers, sshConfig);
  logs = [{ time: formattedTime, server: sshConfig.name }, ...logs];
  saveFile(`${configDir}/config.json`, config);
  saveFile(`${configDir}/logs.json`, logs);

  return [config, logs];
}

export default updateConfigs;
