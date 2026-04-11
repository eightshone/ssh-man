import select from "@inquirer/select";
import { CONFIG_DIR } from "../../../utils/consts";
import saveFile from "../../../utils/saveFile";
import { config, menu, server } from "../../../utils/types";

async function deleteConnection(
  initialConfig: config,
  selectedServer: server,
  serverIndex: number
): Promise<[menu, string[]?]> {
  const deleteServer: boolean = await select({
    message: `Delete ${selectedServer.name}`,
    choices: [
      {
        name: "🗑️ Confirm and delete",
        value: true,
      },
      {
        name: "🚫 Cancel",
        value: false,
      },
    ],
  });
  if (deleteServer) {
    const config: config = { ...initialConfig };
    const { servers } = initialConfig;

    servers.splice(serverIndex, 1);

    config.servers = servers;

    await saveFile(`${CONFIG_DIR}/config.json`, config, undefined, true);

    return ["ssh-list"];
  }

  return ["ssh-display", [JSON.stringify(selectedServer), `${serverIndex}`]];
}

export default deleteConnection;
