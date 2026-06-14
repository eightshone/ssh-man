import stringPadding from "../../../utils/stringPadding";
import { menu, server } from "../../../utils/types";
import checkbox from "@inquirer/checkbox";
import input from "@inquirer/input";
import confirm from "@inquirer/confirm";
import passwordPrompt from "@inquirer/password";
import { existsSync } from "fs";
import saveFile from "../../../utils/saveFile";
import { encryptWithPassword } from "../../../utils/crypto";
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

  // Password-based encryption flow
  let password: string | undefined;
  let done = false;
  while (!done) {
    const encrypt = await confirm({
      message: "Would you like to encrypt this file with a password?",
      default: true,
    });
    if (encrypt) {
      const pw = await passwordPrompt({
        message: "Enter encryption password:",
      });
      if (!pw) {
        console.log("Password cannot be empty.");
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
      done = true;
    } else {
      console.log(
        "Warning: Exporting configurations without encryption exposes sensitive data (like passwords/private keys).",
      );
      const proceed = await confirm({
        message: "Are you sure you want to proceed without encryption?",
        default: false,
      });
      if (proceed) {
        done = true;
      }
    }
  }

  const exportData = password
    ? encryptWithPassword(JSON.stringify(selectedServers), password)
    : selectedServers;

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
