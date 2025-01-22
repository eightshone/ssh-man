import select, { Separator } from "@inquirer/select";
import colors from "yoctocolors-cjs";
import { menu, server } from "../utils/types";
import { inquirerTheme } from "../utils/themes";
import stringPadding from "../utils/stringPadding";

async function listConnections(servers: server[]): Promise<[menu, string[]]> {
  let options: string[] | null = null;

  const recents = servers.length
    ? [
        {
          name: colors.dim(`  #  ${stringPadding("Name")}  Config`),
          disabled: " ",
          value: null,
        },
        ...servers.map((server, index) => ({
          name: `${stringPadding(
            `${index + 1}`,
            3,
            "start",
            "0"
          )}  ${stringPadding(server.name)}  ${server.username}:[redacted]@${
            server.host
          }:${server.port}`,
          value: `ssh-display ${JSON.stringify(server)}`,
          description: "Connect to server",
        })),
      ]
    : [
        {
          name: "  📭 No saved servers! Add a new server or connect to one and it will appear here",
          value: "recent-sessions",
          disabled: " ",
        },
      ];

  console.log("🗃️ Saved servers");
  console.log('   Use "Search" option to enter search mode');
  let answer = await select({
    message: "Saved servers",
    choices: [
      {
        name: "🔍 Search",
        value: "ssh-search",
        description: "Enter search mode",
      },
      {
        name: "↩️ Main menu",
        value: "main",
        description: "Return to main menu",
      },
      new Separator(" "),
      ...recents,
    ],
    theme: inquirerTheme,
    pageSize: 14,
  });

  if (answer !== "exit") {
    console.clear();
  }

  if (answer.startsWith("ssh-display")) {
    [answer, ...options] = answer.split(" ");
  }

  return [answer as menu, options];
}

export default listConnections;
