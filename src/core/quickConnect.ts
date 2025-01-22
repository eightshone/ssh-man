import { config, log, menu, server } from "../utils/types";
import updateConfigs from "../utils/updateConfigs";
import sshConnection from "./ssh";

async function quickConnect(
  config: config,
  logs: log[],
  sshConfig: server
): Promise<[menu, config, log[]]> {
  const [updatedConfig, updatedLogs] = await updateConfigs(
    config,
    logs,
    sshConfig,
    true
  );

  console.clear();
  await sshConnection(sshConfig);

  return ["main", updatedConfig, updatedLogs];
}

export default quickConnect;
