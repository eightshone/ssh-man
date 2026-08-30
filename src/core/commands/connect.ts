import resolveConnection from "../../utils/resolveConnection";
import updateConfigs from "../../utils/updateConfigs";
import validateServerName from "../../utils/validateServerName";
import init from "../functions/init";
import sshConnection from "../functions/ssh";

async function connectCommand(
  creds: string,
  options: { password?: boolean; save?: boolean | string },
) {
  // intialize the cli app
  let { config, logs } = await init();

  // save connection may contains the server name
  const saveConnection: string | boolean | undefined = options.save;
  const promptPassword: boolean = !!options.password;

  const { sshConfig, isNewConnection, error } = await resolveConnection(
    creds,
    config.servers,
    promptPassword,
  );
  if (!sshConfig) {
    console.log(error);
    return;
  }

  if (isNewConnection) {
    if (
      !!saveConnection &&
      typeof saveConnection === "string" &&
      !!saveConnection?.length
    ) {
      const isValid: boolean | string = validateServerName(
        saveConnection,
        config.servers,
      );

      if (isValid === true) {
        sshConfig.name = saveConnection;
      } else {
        console.log(`${isValid}`);
        return;
      }
    } else if (!!saveConnection && typeof saveConnection === "boolean") {
      console.log(
        `ℹ️ You did not specify a name for this config! It will be saved under the name: ${sshConfig.name}`,
      );
    }
  }

  [config, logs] = await updateConfigs(
    config,
    logs,
    sshConfig,
    !!saveConnection && isNewConnection,
  );

  await sshConnection(sshConfig);
}

export default connectCommand;
