import colors from "yoctocolors-cjs";
import { CONFIG_DIR } from "../../utils/consts";
import loadFile from "../../utils/loadFile";
import saveFile from "../../utils/saveFile";
import { config } from "../../utils/types";

/**
 * Handles `sshman debug <action>` subcommands.
 * - enable:  turn on debug mode
 * - disable: turn off debug mode
 * - status:  show current debug status
 */
async function debugCommand(action: string) {
  const validActions = ["enable", "disable", "status"];
  const configFile = `${CONFIG_DIR}/config.json`;

  if (!validActions.includes(action)) {
    console.log(colors.red(`Unknown action: "${action}"`));
    console.log(colors.dim(`Valid actions: ${validActions.join(", ")}`));
    return;
  }

  const configObj: config = await loadFile(configFile, true);

  switch (action) {
    case "enable": {
      configObj.debug = true;
      await saveFile(configFile, configObj, undefined, true);
      console.log(colors.green("✓ Debug mode enabled."));
      console.log(
        colors.dim("  Advanced troubleshooting features are now available."),
      );
      break;
    }

    case "disable": {
      configObj.debug = false;
      await saveFile(configFile, configObj, undefined, true);
      console.log(colors.green("✓ Debug mode disabled."));
      break;
    }

    case "status": {
      console.log("");
      console.log(colors.cyan("🔧 Debug Status"));
      console.log("");

      const stateLabel =
        configObj.debug === true
          ? colors.green("Enabled")
          : colors.red("Disabled");

      console.log(`  Status: ${stateLabel}`);
      console.log("");
      break;
    }
  }
}

export default debugCommand;
