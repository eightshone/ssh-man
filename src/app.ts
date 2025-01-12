import { Command } from "commander";
import init from "./core/init";
const program = new Command();

program
  .name("sshman")
  .description("A simple terminmal based SSH manager created in Node.js")
  .version("0.1.0");

program.parse();

init();
