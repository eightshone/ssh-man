import select from "@inquirer/select";
import promptSSHConfig from "./promptSSHConfig";
import { menu } from "../utils/types";
import sshConnection from "./ssh";

async function newConnection(): Promise<menu> {
  const saveConnection: boolean | null = await select({
    message: "Save connection",
    choices: [
      {
        name: "✔️ YES",
        value: true,
        description: "Save this new conenction to the servers list",
      },
      {
        name: "❌ No",
        value: false,
        description: "Connect without saving",
      },
      {
        name: "↩️ Exit",
        value: null,
        description: "Exit to main menu",
      },
    ],
  });

  if (saveConnection !== null) {
    const sshConfig = await promptSSHConfig(saveConnection);
    console.clear();
    await sshConnection(sshConfig);
  }

  return "main";
}

export default newConnection;
