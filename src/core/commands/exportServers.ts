import dayjs from "dayjs";
import normalizeServerName from "../../utils/normalizeServerName";
import { server } from "../../utils/types";
import init from "../functions/init";
import { existsSync } from "fs";
import saveFile from "../../utils/saveFile";
import passwordPrompt from "@inquirer/password";
import { encryptWithPassword } from "../../utils/crypto";
import buildExportedServers from "../../utils/buildExportedServers";

async function exportServers(servers: string[] = [], options: { all?: boolean; name?: string; force?: boolean; password?: string }) {
  // get or generate output filename
  const fileName = options.name?.length
    ? options.name
    : `config-export-${dayjs().format("YYYY-MM-DD---HH-mm-ss")}.cfg`;
  const { config } = await init({ silent: true });

  // normalize selected servers' names
  const normalizedServerNames = servers.map((serverName: string) =>
    normalizeServerName(serverName),
  );

  let serverConfigs: server[] = [];

  // check if the user wants to export all or not, the all option will ignore any
  if (options.all) {
    serverConfigs = config.servers;
  } else {
    serverConfigs = config.servers.filter((server: server) =>
      normalizedServerNames.includes(normalizeServerName(server.name)),
    );
  }

  // check if the output file should be replaced or not
  if (!options.force && existsSync(fileName)) {
    throw new Error("File exists!");
  }

  let password = options.password;
  if (!password) {
    password = await passwordPrompt({ message: "Enter encryption password:" });
  }
  if (!password) {
    console.log("A password is required to export. Exports are always encrypted.");
    process.exit(1);
  }

  const exportableServers = await buildExportedServers(serverConfigs);
  const exportData = encryptWithPassword(JSON.stringify(exportableServers), password);

  try {
    await saveFile(fileName, exportData);
    console.log(`Configurations successfully exported to ${fileName}`);
  } catch (error: any) {
    console.error(`Failed to export configurations: ${error.message}`);
    process.exit(1);
  }
  process.exit();
}

export default exportServers;
