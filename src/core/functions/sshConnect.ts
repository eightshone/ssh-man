import { config, log, menu, server } from "../../utils/types";
import updateConfigs from "../../utils/updateConfigs";
import { setServerPassword } from "../../utils/secret";
import sshConnection from "./ssh";

async function sshConnect(
  config: config,
  logs: log[],
  sshConfig: server,
  password: string | undefined,
  shouldSave: boolean = false,
): Promise<[menu, config, log[], string[]?]> {
  try {
    // false when the keyring is unavailable: hand the password to ssh directly
    let saved = false;
    if (shouldSave && sshConfig.usePassword && password) {
      saved = await setServerPassword(sshConfig.id, password);
    }

    const [updatedConfig, updatedLogs] = await updateConfigs(
      config,
      logs,
      sshConfig,
      shouldSave,
    );

    await sshConnection(sshConfig, saved ? undefined : password, true);

    return ["main", updatedConfig, updatedLogs];
  } catch (error: any) {
    return ["ssh-error" as menu, config, logs, [error.message, "main"]];
  }
}

export default sshConnect;
