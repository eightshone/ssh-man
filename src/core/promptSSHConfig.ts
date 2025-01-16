import input from "@inquirer/input";
import select from "@inquirer/select";
import password from "@inquirer/password";
import number from "@inquirer/number";
import { homedir } from "os";
import { server } from "../utils/types";

async function promptSSHConfig(saveConnection = false): Promise<server> {
  const host = await input({ message: "Hostname:", required: true });
  const username = await input({ message: "Username:", required: true });
  const port = await number({ message: "Port(22):", default: 22 });
  const usePassword = await select({
    message: "Authentication method:",
    choices: [
      {
        name: "🔒 Password",
        value: true,
        description: "Use password to connect",
      },
      {
        name: "🔑 Key",
        value: false,
        description: "Use private key to connect",
      },
    ],
  });

  const auth = usePassword
    ? await password({ message: "Password:" })
    : await input({ message: `Key path(${homedir}/.shh/id_rsa):` });

  let name;
  if (saveConnection) {
    name = await input({ message: `Server name(${username}@${host}):` });
  }

  return {
    name: name?.length ? name : `${username}@${host}`,
    host,
    username,
    port,
    ...(usePassword
      ? { usePassword: true, password: auth }
      : {
          usePassword: false,
          privateKey: auth?.length ? auth : `${homedir}/.shh/id_rsa`,
        }),
  };
}

export default promptSSHConfig;
