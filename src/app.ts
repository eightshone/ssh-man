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
import mcpCommand from "./core/commands/mcp";
import importServers from "./core/commands/importServers";
import searchCommand from "./core/commands/search";
import debugCommand from "./core/commands/debug";
import { ansi } from "./utils/tui/index";

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
    "credentials in the format of username[:password]@server[:port]",
  )
  .option("-p, --password")
  .option("-s, --save [name]")
  .description("connect to a new session")
  .action(connectCommand);

program
  .command("reconnect")
  .description("reconnect to the last session")
  .action(reconnectCommand);

program
  .command("mcp")
  .argument(
    "<string>",
    "server name, or credentials in the format of username[:password]@server[:port]",
  )
  .option("-p, --password", "prompt for password authentication")
  .description("start an MCP server exposing a single ssh connection")
  .action(mcpCommand);

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
    "export all server configurations (ignores any input server names)",
  )
  .option("-n, --name <file name>", "custom name for output file")
  .option("-f, --force", "replace existing file")
  .option(
    "-p, --password <password>",
    "password to encrypt the exported config file",
  )
  .option(
    "-e, --encrypt",
    "prompt for a password to encrypt the exported config file",
  )
  .description("exports server configurations")
  .action(exportServers);

program
  .command("import")
  .argument("<config file>", "config file containing server configs")
  .option("-f, --force", "replace configs with the same name")
  .option(
    "-p, --password <password>",
    "password to decrypt the imported config file",
  )
  .description("import server configurations")
  .action(importServers);

program
  .command("search")
  .argument("<terms...>", "search terms")
  .option("-f, --fuzzy", "make a fuzzy search")
  .description("search for a server config")
  .action(searchCommand);

program
  .command("debug")
  .argument("<action>", "enable, disable, or status")
  .description("manage advanced troubleshooting settings")
  .action(debugCommand);

program
  .command("goodbye")
  .description("says goodbye")
  .action(() => {
    goodbye();
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
    process.stdout.write(ansi.showCursor() + ansi.clear() + ansi.moveTo(1, 1));
    process.stdout.write(ansi.altScreenExit());
    goodbye();
    process.exit(0);
  } else {
    process.stdout.write(ansi.altScreenExit());
    // Rethrow unknown errors
    throw error;
  }
});
