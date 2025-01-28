import input from "@inquirer/input";
import select from "@inquirer/select";
import password from "@inquirer/password";
import number from "@inquirer/number";
import { homedir } from "os";
import { config, server } from "../../utils/types";
import validateServerName from "../../utils/validateServerName";
import { nanoid } from "nanoid";

async function promptSSHConfig(
  saveConnection = false,
  config: config
): Promise<server> {
  const host = await input({ message: "Hostname:", required: true });
  const username = await input({ message: "Username:", required: true });
  const port = await number({
    message: `Port(${config.defaults.port}):`,
    default: config.defaults.port,
  });
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
    : await input({ message: `Key path(${config.defaults.privateKey}):` });

  let name;
  if (saveConnection) {
    name = await input({
      message: `Server name(${config.defaults.autoSavePrefix}-${username}@${host}):`,
      validate: (value) => validateServerName(value, config.servers),
    });
  }

  return {
    id: nanoid(),
    name: name?.length
      ? name
      : `${config.defaults.autoSavePrefix}-${username}@${host}`,
    host,
    username,
    port,
    ...(usePassword
      ? { usePassword: true, password: auth }
      : {
          usePassword: false,
          privateKey: auth?.length ? auth : config.defaults.privateKey,
        }),
  };
}

export default promptSSHConfig;
