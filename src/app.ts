#!/usr/bin/env node

import { Command } from "commander";
import init from "./core/functions/init";
import { VERSION } from "./utils/consts";
import interactive from "./core/ui/interactive";
import goodbye from "./utils/goodbye";
import connectCommand from "./core/commands/connect";
import logs from "./core/commands/logs";
import exportServers from "./core/commands/exportServers";
import isSameVersion from "./core/functions/isSameVersion";
import showUpdateMessage from "./core/functions/showUpdateMessage";
import reconnectCommand from "./core/commands/reconnect";

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
  .command("reconnect")
  .description("reconnect to the last session")
  .action(reconnectCommand);

program
  .command("logs")
  .option("-i, --interactive")
  .option("-s, --search <terms>")
  .description("print logs")
  .action(logs);

program
  .command("export")
  .argument("[servers...]", "server names separated by spaces")
  .option(
    "-a, --all",
    "export all server configurations (ignores any input server names)"
  )
  .option("-n, --name <file name>", "custom name for output file")
  .option("-f, --force", "replace existing file")
  .description("exports server configurations")
  .action(exportServers);

program
  .command("goodbye")
  .description("says goodbye")
  .action(() => {
    goodbye();
    process.exit();
  });

program
  .command("check-updates")
  .description("check for updates")
  .action(async () => {
    const [isUptodate, manager] = await isSameVersion();
    showUpdateMessage(isUptodate, manager);
  });

program.parse();

async function app() {
  // intialize the cli app
  const { config, logs } = await init();

  await interactive(config, logs, program);
}

process.on("uncaughtException", (error) => {
  if (error instanceof Error && error.name === "ExitPromptError") {
    goodbye();
  } else {
    // Rethrow unknown errors
    throw error;
  }
});
