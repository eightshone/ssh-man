import select, { Separator } from "@inquirer/select";
import colors from "yoctocolors-cjs";
import { inquirerTheme } from "../../../utils/themes";
import { config, menu } from "../../../utils/types";
import stringPadding from "../../../utils/stringPadding";

async function settings(config: config): Promise<[menu, string[]]> {
  let options: string[] = [];
  const columnWidth = Math.floor(process.stdout.columns / 2 - 1);
  console.clear();
  console.log("Settings:");

  let answer = await select({
    message: " ",
    choices: [
      new Separator(colors.dim("📋 Defaults")),
      {
        name: `${stringPadding("Port", columnWidth)} ${stringPadding(
          `${config.defaults.port}`,
          columnWidth,
          "start"
        )}`,
        value: `settings-defaults-edit#-_-#${JSON.stringify({
          message: "Edit default port",
          defaultValue: config.defaults.port,
          type: "number",
        })}`,
        description: `\nPress ${colors.inverse(
          " ENTER ↵ "
        )} to edit default port`,
      },
      {
        name: `${stringPadding(
          "Private key path",
          columnWidth
        )} ${stringPadding(
          `${config.defaults.privateKey}`,
          columnWidth,
          "start"
        )}`,
        value: `settings-defaults-edit#-_-#${JSON.stringify({
          message: "Edit default private key path",
          defaultValue: config.defaults.privateKey,
          type: "private-key",
        })}`,
        description: `\nPress ${colors.inverse(
          " ENTER ↵ "
        )} to edit default private key path`,
      },
      {
        name: `${stringPadding("Autosave prefix", columnWidth)} ${stringPadding(
          `${config.defaults.autoSavePrefix}`,
          columnWidth,
          "start"
        )}`,
        value: `settings-defaults-edit#-_-#${JSON.stringify({
          message: "Edit autosave prefix",
          defaultValue: config.defaults.autoSavePrefix,
          type: "server-name",
        })}`,
        description: `\nPress ${colors.inverse(
          " ENTER ↵ "
        )} to edit autosave prefix`,
      },

      new Separator(colors.dim("\n🛡️ Security")),
      {
        name: colors.dim(
          "🚧 Security features will be introduced in future versions."
        ),
        value: null,
        disabled: " ",
      },

      new Separator(colors.dim("\n🗃️ Backups")),
      {
        name: colors.dim("🚧 Backups will be supported in future versions."),
        value: null,
        disabled: " ",
      },

      new Separator(" "),
      {
        name: "↩️ Main menu",
        value: "main",
        description: "Return to main menu",
      },
    ],
    pageSize: 30,
    theme: inquirerTheme,
  });

  console.clear();

  if (answer.startsWith("settings-defaults-edit")) {
    [answer, ...options] = answer.split("#-_-#");
  }

  return [answer as menu, options];
}

export default settings;
