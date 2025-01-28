import { Command } from "commander";
import select from "@inquirer/select";
import { menu } from "../../utils/types";
import { inquirerTheme } from "../../utils/themes";

async function manual(program: Command): Promise<[menu]> {
  console.log(program.helpInformation());

  await select({
    message: "",
    choices: [
      {
        name: "↩️ Exit Manual",
        value: null,
      },
    ],
    theme: inquirerTheme,
  });

  console.clear();

  return ["main"];
}

export default manual;
