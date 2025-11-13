import findServer from "../../utils/findServer";
import isConnectionString from "../../utils/isConnectionString";
import parseConnectionString from "../../utils/parseConnectionString";
import { server } from "../../utils/types";
import updateConfigs from "../../utils/updateConfigs";
import validateServerName from "../../utils/validateServerName";
import init from "../functions/init";
import sshConnection from "../functions/ssh";

async function connectCommand(creds: string, options) {
  // intialize the cli app
  let { config, logs } = await init();

  // save connection may contains the server name
  const saveConnection: string | boolean = options.save;
  const promptPassword: boolean = options.password;
  let sshConfig: server | undefined;

  const newConnection = isConnectionString(creds);

  if (newConnection) {
    sshConfig = await parseConnectionString(creds, promptPassword);

    if (
      !!saveConnection &&
      typeof saveConnection === "string" &&
      !!saveConnection?.length
    ) {
      const isValid: boolean | string = validateServerName(
        saveConnection,
        config.servers
      );

      if (isValid === true) {
        sshConfig.name = saveConnection;
      } else {
        console.log(`❌ ${isValid}`);
        return;
      }
    } else if (!!saveConnection && typeof saveConnection === "boolean") {
      console.log(
        `ℹ️ You did not specify a name for this config! It will be saved under the name: ${sshConfig.name}`
      );
    }
  } else {
    sshConfig = findServer(config.servers, creds);
    if (!sshConfig) {
      console.log("❌ Server config not found!");
      return;
    }
  }

  [config, logs] = await updateConfigs(
    config,
    logs,
    sshConfig,
    !!saveConnection && newConnection
  );

  sshConnection(sshConfig);
}

export default connectCommand;
