import stringPadding from "../../../utils/stringPadding";
import { menu, server } from "../../../utils/types";
import checkbox from "@inquirer/checkbox";
import input from "@inquirer/input";
import confirm from "@inquirer/confirm";
import passwordPrompt from "@inquirer/password";
import { existsSync } from "fs";
import saveFile from "../../../utils/saveFile";
import { encryptWithPassword } from "../../../utils/crypto";
import buildExportedServers from "../../../utils/buildExportedServers";
import dayjs from "dayjs";

async function exportConnections(
  servers: server[],
  preSelected?: server[],
): Promise<[menu, string[]?]> {
  console.log("Export configurations");

  let selectedServers: server[] = [];
  if (preSelected && preSelected.length > 0) {
    selectedServers = preSelected;
  } else {
    selectedServers = await checkbox({
      message:
        "Select configurations to export (space to check/uncheck, enter to confirm):",
      choices: servers.map((server) => ({
        name: `${stringPadding(server.name)}  ${server.username}:[redacted]@${server.host}:${server.port}`,
        value: server,
      })),
    });
  }

  if (selectedServers.length === 0) {
    console.clear();
    return ["ssh-list" as menu];
  }

  let fileName: string | undefined;
  while (!fileName?.length) {
    const proposedName = await input({
      message: "Pick a name for your exported file",
      default: `config-export-${dayjs().format("YYYY-MM-DD---HH-mm-ss")}.cfg`,
    });

    if (!proposedName.length) continue;

    const fileExists = existsSync(proposedName);

    if (!fileExists || (fileExists && (await overWriteFile(proposedName)))) {
      fileName = proposedName;
    }
  }

  // exports are always encrypted
  let password: string | undefined;
  while (!password) {
    const pw = await passwordPrompt({
      message: "Enter encryption password:",
    });
    if (!pw) {
      console.log("A password is required. Exports are always encrypted.");
      continue;
    }
    const confirmPw = await passwordPrompt({
      message: "Confirm encryption password:",
    });
    if (pw !== confirmPw) {
      console.log("Passwords do not match. Please try again.");
      continue;
    }
    password = pw;
  }

  const exportableServers = await buildExportedServers(selectedServers);
  const exportData = encryptWithPassword(JSON.stringify(exportableServers), password);

  try {
    await saveFile(fileName, exportData);
    console.log(`Configurations successfully exported to ${fileName}`);
  } catch (error: any) {
    console.error(`Failed to export configurations: ${error.message}`);
    return ["ssh-list" as menu];
  }

  // Small delay to let the user see the success message
  await new Promise((resolve) => setTimeout(resolve, 1500));

  console.clear();
  return ["ssh-list" as menu];
}

export default exportConnections;

async function overWriteFile(name: string): Promise<boolean> {
  const overWrite = await confirm({
    message: `The file "${name}" exists. Would you like to overwrite it?`,
    default: false,
  });
  return overWrite;
}
