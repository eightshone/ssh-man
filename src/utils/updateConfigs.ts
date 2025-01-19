import { configDir } from "./consts";
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
  let logs: log[] = { ...initialLogs };

  config.servers = [...config.servers, sshConfig];
  config.recentServers = updateRecentServers(config.recentServers, sshConfig);
  logs = [{ time: formattedTime, server: sshConfig.name }, ...logs];
  saveFile(`${configDir}/config.json`, config);
  saveFile(`${configDir}/logs.json`, logs);

  return [config, logs];
}

export default updateConfigs;
