import select from "@inquirer/select";
import colors from "yoctocolors-cjs";
import clipboard from "clipboardy";
import { menu, server } from "../../../utils/types";
import stringPadding from "../../../utils/stringPadding";

async function displayConnection(
  sshConfig: server,
  index: number,
  passwordCopied?: boolean,
): Promise<[menu, string[]]> {
  console.log(colors.dim("Server name"));
  console.log(`   ${sshConfig.name}
    `);
  console.log(
    colors.dim(
      `${stringPadding("Username", 44)} ${
        sshConfig.usePassword ? "Password" : "Key"
      }`,
    ),
  );
  console.log(
    `   ${stringPadding(sshConfig.username)}     ${
      sshConfig.usePassword === true ? "********" : sshConfig.privateKey
    }
    `,
  );
  console.log(colors.dim(`${stringPadding("Hostname", 44)} Port`));
  console.log(`   ${stringPadding(sshConfig.host)}     ${sshConfig.port}
  `);

  let answer = await select({
    message: "Select action",
    choices: [
      {
        name: "Connect",
        value: "ssh-connect",
        description: "Connect to server",
      },
      ...(sshConfig.usePassword
        ? [
            {
              name: passwordCopied
                ? "Password copied to clipboard"
                : "Copy password to clipborad",
              value: "ssh-password",
              description: "Edit server password to clipboard",
            },
          ]
        : []),
      {
        name: "Edit",
        value: "ssh-edit",
        description: "Edit server configuration",
      },
      {
        name: "Delete",
        value: "ssh-delete",
        description: "Delete server config",
      },

      {
        name: "Back to servers list",
        value: "ssh-list",
        description: "Return to servers list",
      },
    ],
    loop: false,
    default: passwordCopied ? "ssh-password" : "ssh-connect",
  });

  console.clear();

  let copyPassword = false;
  if (answer === "ssh-password" && sshConfig.usePassword) {
    clipboard.writeSync(sshConfig.password);
    copyPassword = true;
    answer = "ssh-display";
  }

  return [
    answer as menu,
    [JSON.stringify(sshConfig), `${index}`, `${copyPassword}`],
  ];
}

export default displayConnection;
