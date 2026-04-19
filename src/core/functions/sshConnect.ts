import { config, log, menu, server } from "../../utils/types";
import updateConfigs from "../../utils/updateConfigs";
import sshConnection from "./ssh";

async function sshConnect(
  config: config,
  logs: log[],
  sshConfig: server,
  shouldSave: boolean = false,
): Promise<[menu, config, log[], string[]?]> {
  try {
    const [updatedConfig, updatedLogs] = await updateConfigs(
      config,
      logs,
      sshConfig,
      shouldSave,
    );

    await sshConnection(sshConfig, false);

    return ["main", updatedConfig, updatedLogs];
  } catch (error: any) {
    return ["ssh-error" as menu, config, logs, [error.message, "main"]];
  }
}

export default sshConnect;
