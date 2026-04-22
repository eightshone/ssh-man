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
import importServers from "./core/commands/importServers";
import searchCommand from "./core/commands/search";
import telemetryCommand from "./core/commands/telemetry";
import debugCommand from "./core/commands/debug";
import { ansi } from "./utils/tui/index";
import {
  initTelemetry,
  recordCommandEvent,
  trySync,
  TelemetryContext,
} from "./core/telemetry/index";

const program = new Command();

// Shared telemetry context — initialized before any command runs
let telemetryCtx: TelemetryContext;
let commandStartTime: number;

program
  .name("sshman")
  .description("A simple terminmal based SSH manager created in Node.js")
  .version(VERSION, "-v, --version", "output the version number");

// Initialize telemetry before any command executes.
// This handles the first-run consent prompt and loads the config.
program.hook("preAction", async (thisCommand, actionCommand) => {
  const commandName = actionCommand.name();

  // Skip telemetry init for telemetry subcommands (they manage config directly)
  const skipConsent = commandName === "telemetry";
  telemetryCtx = await initTelemetry(skipConsent);

  commandStartTime = performance.now();
});

// Record telemetry events and attempt sync after each command.
program.hook("postAction", async (thisCommand, actionCommand) => {
  if (telemetryCtx) {
    const durationMs = performance.now() - commandStartTime;
    const commandName = actionCommand.name() || "interactive";

    await recordCommandEvent(telemetryCtx, commandName, durationMs, true);
    await trySync(telemetryCtx);
  }
});

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
  .description("exports server configurations")
  .action(exportServers);

program
  .command("import")
  .argument("<config file>", "config file containing server configs")
  .option("-f, --force", "replace configs with the same name")
  .description("import server configurations")
  .action(importServers);

program
  .command("search")
  .argument("<terms...>", "search terms")
  .option("-f, --fuzzy", "make a fuzzy search")
  .description("search for a server config")
  .action(searchCommand);

program
  .command("telemetry")
  .argument("<action>", "enable, disable, or status")
  .description("manage anonymous telemetry settings")
  .action(telemetryCommand);

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

    // Record the error in telemetry before rethrowing
    if (telemetryCtx?.active) {
      const durationMs = performance.now() - commandStartTime;
      const errorType =
        error instanceof Error ? error.constructor.name : "UnknownError";
      recordCommandEvent(
        telemetryCtx,
        "uncaughtException",
        durationMs,
        false,
        errorType,
      ).catch(() => {});
    }

    // Rethrow unknown errors
    throw error;
  }
});
