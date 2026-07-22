import colors from "yoctocolors-cjs";
import { CONFIG_DIR } from "../../utils/consts";
import loadFile from "../../utils/loadFile";
import { config } from "../../utils/types";
import {
  installZshPlugin,
  uninstallZshPlugin,
  getZshPluginStatus,
} from "../integrations/zshPlugin";

/**
 * Handles `sshman completion <action>` subcommands.
 * - install:   set up the Oh My Zsh completion plugin
 * - uninstall: remove it
 * - status:    show current status
 */
async function zshPluginCommand(action: string) {
  const validActions = ["install", "uninstall", "status"];
  const configFile = `${CONFIG_DIR}/config.json`;

  if (!validActions.includes(action)) {
    console.log(colors.red(`Unknown action: "${action}"`));
    console.log(colors.dim(`Valid actions: ${validActions.join(", ")}`));
    return;
  }

  switch (action) {
    case "install": {
      const configObj: config = await loadFile(configFile, true);
      const result = await installZshPlugin(configObj);
      console.log(
        result.ok
          ? colors.green(`✓ ${result.message}`)
          : colors.red(`✖ ${result.message}`),
      );
      break;
    }

    case "uninstall": {
      const configObj: config = await loadFile(configFile, true);
      const result = await uninstallZshPlugin(configObj);
      console.log(
        result.ok
          ? colors.green(`✓ ${result.message}`)
          : colors.red(`✖ ${result.message}`),
      );
      break;
    }

    case "status": {
      const status = getZshPluginStatus();

      console.log("");
      console.log(colors.cyan("🔌 Oh My Zsh Plugin Status"));
      console.log("");

      const label =
        status === "installed"
          ? colors.green("Installed")
          : status === "omz_missing"
            ? colors.yellow("Oh My Zsh not detected")
            : colors.red("Not installed");

      console.log(`  Status: ${label}`);
      console.log("");
      break;
    }
  }
}

export default zshPluginCommand;
