import select, { Separator } from "@inquirer/select";
import colors from "yoctocolors-cjs";
import { menu, server } from "../../utils/types";
import { inquirerTheme } from "../../utils/themes";
import title from "../../utils/title";
import stringPadding from "../../utils/stringPadding";

async function mainMenu(
  recentServers: server[] = []
): Promise<[menu, string[] | null]> {
  title();
  const separatorLength = Math.floor((process.stdout.columns / 3) * 2);
  let options: string[] | null = null;
  const recents = recentServers.length
    ? recentServers.map((server, index) => ({
        name: `   ${index + 1} - ${server.name}`,
        value: `ssh-connect#-_-#${JSON.stringify(server)}`,
        description: "Connect to server",
      }))
    : [
        {
          name: "  ⚠️ No recent sessions! Add a new server or connect to one and it will appear here",
          value: "recent-sessions",
          disabled: " ",
        },
      ];
  let answer = await select({
    message: "MAIN MENU",
    choices: [
      {
        name: "✨ Recent sessions",
        value: "recent-sessions",
        disabled: "(select a session to connect quickly)",
      },
      ...recents,
      new Separator(
        colors.dim(
          stringPadding(
            "-",
            separatorLength % 2 === 0 ? separatorLength + 1 : separatorLength,
            "start",
            "-_"
          )
        )
      ),
      {
        name: "💻 New connection",
        value: "ssh-new",
        description: "Connect to a new session",
      },
      {
        name: "🗃️ Saved servers",
        value: "ssh-list",
        description: "See all sessions",
      },
      {
        name: "⚙️ Settings",
        value: "settings",
        description: "User settings",
      },
      {
        name: "📖 Manual",
        value: "manual",
        description: "Help manual",
      },
      {
        name: "🚪 Quit",
        value: "exit",
        description: "Quit sshman",
      },
    ],
    theme: inquirerTheme,
    pageSize: 10,
  });

  if (answer !== "exit") {
    console.clear();
  }

  if (answer.startsWith("ssh-connect")) {
    [answer, ...options] = answer.split("#-_-#");
  }

  return [answer as menu, options];
}

export default mainMenu;
