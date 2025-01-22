import select from "@inquirer/select";
import colors from "yoctocolors-cjs";
import { menu, server } from "../utils/types";
import stringPadding from "../utils/stringPadding";
import { inquirerTheme } from "../utils/themes";

async function displayConnection(sshConfig: server): Promise<[menu, string[]]> {
  console.log(colors.dim("🖥️ Server name"));
  console.log(`   ${sshConfig.name}
    `);
  console.log(
    colors.dim(
      `${stringPadding("🧑 Username", 44)} 🔑 ${
        sshConfig.usePassword ? "Password" : "Key"
      }`
    )
  );
  console.log(
    `   ${stringPadding(sshConfig.username)}     ${
      sshConfig.usePassword === true ? "********" : sshConfig.privateKey
    }
    `
  );
  console.log(colors.dim(`${stringPadding("🌐 Hostname", 44)} 🔌 Port`));
  console.log(`   ${stringPadding(sshConfig.host)}     ${sshConfig.port}
  `);

  const answer = await select({
    message: "Select action",
    choices: [
      {
        name: "🚀 Connect",
        value: "ssh-connect",
        description: "Connect to server",
      },
      {
        name: "✍️ Edit",
        value: "ssh-edit",
        description: "Edit server configuration",
        disabled: "(Coming soon…)",
      },
      {
        name: "❌ Delete",
        value: "ssh-delete",
        description: "Delete server config",
        disabled: "(Coming soon…)",
      },

      {
        name: "↩️ Server list",
        value: "ssh-list",
        description: "Return to servers list",
      },
    ],
    loop: false,
  });

  console.clear();

  return [answer as menu, [JSON.stringify(sshConfig)]];
}

export default displayConnection;
