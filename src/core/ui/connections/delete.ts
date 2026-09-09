import select from "@inquirer/select";
import saveConfig from "../../../utils/saveConfig";
import { deleteServerPassword } from "../../../utils/secret";
import { config, menu, server } from "../../../utils/types";

export async function performDelete(initialConfig: config, serverIndex: number | number[]) {
  const config: config = { ...initialConfig };
  let { servers } = initialConfig;

  const indices = Array.isArray(serverIndex) ? serverIndex : [serverIndex];
  await Promise.all(
    indices.map((idx) => {
      const srv = servers[idx];
      return srv?.usePassword ? deleteServerPassword(srv.id) : Promise.resolve();
    }),
  );

  if (Array.isArray(serverIndex)) {
    // Collect specific indices to remove
    const indicesToRemove = new Set(serverIndex);
    servers = servers.filter((_, idx) => !indicesToRemove.has(idx));
  } else {
    servers.splice(serverIndex, 1);
  }

  config.servers = servers;

  await saveConfig(config);
  return config;
}

async function deleteConnection(
  initialConfig: config,
  selectedServer: server,
  serverIndex: number,
): Promise<[menu, string[]?]> {
  const deleteServer: boolean = await select({
    message: `Delete ${selectedServer.name}`,
    choices: [
      {
        name: "Confirm and delete",
        value: true,
      },
      {
        name: "Cancel",
        value: false,
      },
    ],
  });
  if (deleteServer) {
    await performDelete(initialConfig, serverIndex);
    return ["ssh-list"];
  }

  return ["ssh-display", [JSON.stringify(selectedServer), `${serverIndex}`]];
}

export default deleteConnection;
