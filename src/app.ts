import { Command } from "commander";
import init from "./core/init";
import { VERSION } from "./utils/consts";
import interactive from "./core/interactive";
import goodbye from "./utils/goodbye";
import parseConnectionString from "./utils/parseConnectionString";
import sshConnection from "./core/ssh";
import { server } from "./utils/types";
import updateConfigs from "./utils/updateConfigs";
import isConnectionString from "./utils/isConnectionString";
import findServer from "./utils/findServer";
import validateServerName from "./utils/validateServerName";

const program = new Command();

program
  .name("sshman")
  .description("A simple terminmal based SSH manager created in Node.js")
  .version(VERSION, "-v, --version", "output the version number");

program.action(app);

program
  .command("connect")
  .argument(
    "<string>",
    "credentials in the format of username[:password]@server[:port]"
  )
  .option("-s, --save [name]")
  .description("connect to a new session")
  .action(async (creds: string, options) => {
    // intialize the cli app
    let { config, logs } = await init();

    // save connection may contains the server name
    const saveConnection: string | boolean = options.save;
    let sshConfig: server | undefined;

    const newConnection = isConnectionString(creds);

    if (newConnection) {
      sshConfig = parseConnectionString(creds);

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
      } else {
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
  });

program
  .command("goodbye")
  .description("says goodbye")
  .action(() => {
    goodbye();
    process.exit();
  });

program.parse();

async function app() {
  // intialize the cli app
  const { config, logs } = await init();

  await interactive(config, logs);
}

process.on("uncaughtException", (error) => {
  if (error instanceof Error && error.name === "ExitPromptError") {
    goodbye();
  } else {
    // Rethrow unknown errors
    throw error;
  }
});
