import updateConfigs from "../../utils/updateConfigs";
import init from "../functions/init";
import sshConnection from "../functions/ssh";

async function reconnectCommand() {
  // intialize the cli app
  let { config, logs } = await init();

  // exit if there are no recent servers
  if (!config.recentServers.length) {
    console.log("❌ There are no recent sessions");
    return;
  }

  // get last config
  const connectTo = config.recentServers[0];

  console.log(
    `🔄 Reconnecting to "${
      connectTo.name ?? connectTo.username + "@" + connectTo.host
    }"`
  );

  // update logs
  await updateConfigs(config, logs, connectTo, false);

  // connect
  sshConnection(connectTo);
}

export default reconnectCommand;
