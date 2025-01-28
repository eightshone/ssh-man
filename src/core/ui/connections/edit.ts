import input from "@inquirer/input";
import select from "@inquirer/select";
import password from "@inquirer/password";
import number from "@inquirer/number";
import { homedir } from "os";
import { config, log, menu, server } from "../../../utils/types";
import saveFile from "../../../utils/saveFile";
import { CONFIG_DIR } from "../../../utils/consts";
import validateServerName from "../../../utils/validateServerName";

async function editConnection(
  config: config,
  index: number,
  logs: log[]
): Promise<[menu, string[], config]> {
  const sshConfig: server = config.servers[index];

  let updatedSshConfig: server;
  let confirmChanges: boolean | null = false;

  while (confirmChanges === false) {
    const name = await input({
      message: `Server name(${sshConfig.name}):`,
      validate: (value) => validateServerName(value, config.servers),
    });
    const host = await input({ message: `Hostname(${sshConfig.host})` });
    const username = await input({
      message: `Username(${sshConfig.username}):`,
    });
    const port = await number({
      message: `Port(${sshConfig.port}):`,
      default: sshConfig.port,
    });

    const usePassword = await select({
      message: `Keep authentication method? (Current: ${
        sshConfig.usePassword ? "password" : "key"
      }):`,
      choices: [
        {
          name: "Keep current method",
          value: sshConfig.usePassword,
          description: `Keep using ${
            sshConfig.usePassword ? "password" : "key"
          }`,
        },
        {
          name: "Change method",
          value: !sshConfig.usePassword,
          description: `Use ${
            !sshConfig.usePassword ? "password" : "key"
          } instead`,
        },
      ],
    });

    let auth;
    let updateAuthValue;

    if (usePassword === sshConfig.usePassword) {
      updateAuthValue = await select({
        message: `Update ${usePassword ? "password" : "key"}?:`,
        choices: [
          {
            name: "Keep as is",
            value: false,
            description: `Keep ${usePassword ? "password" : "key"} as is`,
          },
          {
            name: "Update",
            value: true,
            description: `Change ${usePassword ? "password" : "key"}`,
          },
        ],
      });
    }

    if (usePassword !== sshConfig.usePassword || updateAuthValue) {
      auth = usePassword
        ? await password({ message: "Password:" })
        : await input({ message: `Key path(${homedir}/.shh/id_rsa):` });
    } else {
      auth =
        sshConfig.usePassword === true
          ? sshConfig.password
          : sshConfig.privateKey;
    }

    updatedSshConfig = {
      id: sshConfig.id,
      name: name.length ? name : sshConfig.name,
      host: host.length ? host : sshConfig.host,
      username: username.length ? username : sshConfig.username,
      port: port ?? sshConfig.port,
      ...(usePassword
        ? { usePassword: true, password: auth }
        : {
            usePassword: false,
            privateKey: auth?.length ? auth : `${homedir}/.shh/id_rsa`,
          }),
    };

    confirmChanges = await select({
      message: "Confirm changes",
      choices: [
        {
          name: "Confirm and save",
          value: true,
          description: "Exit after saving new configuration",
        },
        { name: "No. Redo", value: false, description: "Start over edits" },
        {
          name: "Exit without saving",
          value: null,
          description: "Exit without changing configuration",
        },
      ],
    });

    console.clear();
  }

  if (confirmChanges) {
    config.servers[index] = updatedSshConfig;
    // save config to file
    await saveFile(`${CONFIG_DIR}/config.json`, config);

    if (updatedSshConfig.name !== sshConfig.name) {
      const updatedLogs = logs.map((currentLog) => {
        if (currentLog.server === sshConfig.name) {
          currentLog.server = updatedSshConfig.name;
        }

        return currentLog;
      });

      await saveFile(`${CONFIG_DIR}/logs.json`, updatedLogs);
    }
  }

  return [
    "ssh-display" as menu,
    [JSON.stringify(confirmChanges ? updatedSshConfig : sshConfig), `${index}`],
    config,
  ];
}

export default editConnection;
