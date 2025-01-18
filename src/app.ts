import { Command } from "commander";
import init from "./core/init";
import { VERSION } from "./utils/consts";
import interactive from "./core/interactive";
import goodbye from "./utils/goodbye";
const program = new Command();

program
  .name("sshman")
  .description("A simple terminmal based SSH manager created in Node.js")
  .version(VERSION, "-v, --version", "output the version number");

program.action(app);

program
  .command("connect")
  .argument("<string>", "server name")
  .description("connect to a new session")
  .action((serverName) => {
    console.log(serverName);
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
