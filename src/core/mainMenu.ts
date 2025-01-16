import select, { Separator } from "@inquirer/select";
import { menu } from "../utils/types";
import { inquirerTheme } from "../utils/themes";
import title from "../utils/title";

async function mainMenu(): Promise<menu> {
  title();
  const answer = await select({
    message: "MAIN MENU",
    choices: [
      {
        name: "✨ Recent sessions",
        value: "recent-sessions",
        disabled: "(select a session to connect quickly)",
      },
      // {
      //   name: "   - Server name",
      //   value: "quick-connect-0",
      //   description: "Connect to server",
      // },
      {
        name: "  ⚠️ No recent sessions! Add a new server or connect to one and it will appear here",
        value: "recent-sessions",
        disabled: " ",
      },
      new Separator(),
      {
        name: "💻 Connect now",
        value: "ssh-connect",
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
        name: "🚪 Quit",
        value: "exit",
        description: "Quit sshman",
      },
    ],
    theme: inquirerTheme,
    loop: false,
    pageSize: 10,
  });

  if (answer !== "exit") {
    console.clear();
  }

  return answer as menu;
}

export default mainMenu;
