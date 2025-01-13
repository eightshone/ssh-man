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
  .command("goodbye")
  .description("says goodbye")
  .action(() => {
    goodbye();
    process.exit();
  });

program.parse();

async function app() {
  // intialize the cli app
  await init();

  await interactive();
}

process.on("uncaughtException", (error) => {
  if (error instanceof Error && error.name === "ExitPromptError") {
    goodbye();
  } else {
    // Rethrow unknown errors
    throw error;
  }
});
