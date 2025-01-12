import { Command } from "commander";
import init from "./core/init";
import { VERSION } from "./utils/consts";
const program = new Command();

program
  .name("sshman")
  .description("A simple terminmal based SSH manager created in Node.js")
  .version(VERSION, "-v, --version", "output the version number");

program.parse();

init();
