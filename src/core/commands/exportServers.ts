import dayjs from "dayjs";
import normalizeServerName from "../../utils/normalizeServerName";
import { server } from "../../utils/types";
import init from "../functions/init";
import { existsSync } from "fs";
import saveFile from "../../utils/saveFile";
import createFileIfNotExists from "../../utils/createFileIfNotExist";

async function exportServers(servers: string[] = [], options) {
  const fileName = options.name?.length
    ? options.name
    : `config-export-${dayjs().format("YYYY-MM-DD-HH:mm:ss")}.cfg`;
  const { config } = await init({ silent: true });
  const normalizedServerNames = servers.map((serverName: string) =>
    normalizeServerName(serverName)
  );
  let serverConfigs: server[] = [];
  if (options.all) {
    serverConfigs = config.servers;
  } else {
    serverConfigs = config.servers.filter((server: server) =>
      normalizedServerNames.includes(normalizeServerName(server.name))
    );
  }

  console.log(serverConfigs);
  console.log(fileName);

  if (!options.force && existsSync(fileName)) {
    throw new Error("File exists!");
  } else {
    await await createFileIfNotExists(fileName, JSON.stringify(serverConfigs));
  }

  process.exit();
}

export default exportServers;
