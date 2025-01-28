import { Command } from "commander";
import init from "./core/init";
import { VERSION } from "./utils/consts";
import interactive from "./core/ui/interactive";
import goodbye from "./utils/goodbye";
import parseConnectionString from "./utils/parseConnectionString";
import sshConnection from "./core/ssh";
import { server } from "./utils/types";
import updateConfigs from "./utils/updateConfigs";
import isConnectionString from "./utils/isConnectionString";
import findServer from "./utils/findServer";
import validateServerName from "./utils/validateServerName";
import connectCommand from "./core/commands/connect";

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
  .action(connectCommand);

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
