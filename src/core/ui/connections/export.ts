import stringPadding from "../../../utils/stringPadding";
import { menu, server } from "../../../utils/types";
import checkbox from "@inquirer/checkbox";
import input from "@inquirer/input";
import confirm from "@inquirer/confirm";
import { existsSync } from "fs";
import saveFile from "../../../utils/saveFile";

async function exportConnections(
  servers: server[]
): Promise<[menu, string[]?]> {
  console.log("📤 Export configurations");
  let selectedConfigs = await checkbox({
    message: "To exit this menu, do not select any configration",
    choices: [
      ...servers.map((server, index) => ({
        name: `${stringPadding(server.name)}  ${server.username}:[redacted]@${
          server.host
        }:${server.port}`,
        value: JSON.stringify(server),
      })),
    ],
  });

  if (selectedConfigs.length) {
    let fileName: string | undefined;
    while (!fileName?.length) {
      const proposedName = await filename();

      if (!proposedName.length) continue;

      const fileExists = existsSync(proposedName);

      if (!fileExists || (fileExists && (await overWriteFile(proposedName)))) {
        await saveFile(proposedName, selectedConfigs);
        fileName = proposedName;
      }
    }
  }

  console.clear();

  return ["ssh-list" as menu];
}

export default exportConnections;

async function filename(): Promise<string> {
  const name = await input({
    message: "Pick a name for your exported file",
  });

  return name;
}

async function overWriteFile(name: string): Promise<boolean> {
  const overWrite = await confirm({
    message: `The file "${name}" exists. Would you like to overwrite it?`,
    default: false,
  });
  return overWrite;
}
