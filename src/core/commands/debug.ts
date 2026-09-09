import colors from "yoctocolors-cjs";
import saveConfig from "../../utils/saveConfig";
import init from "../functions/init";

/**
 * Handles `sshman debug <action>` subcommands.
 * - enable:  turn on debug mode
 * - disable: turn off debug mode
 * - status:  show current debug status
 */
async function debugCommand(action: string) {
  const validActions = ["enable", "disable", "status"];

  if (!validActions.includes(action)) {
    console.log(colors.red(`Unknown action: "${action}"`));
    console.log(colors.dim(`Valid actions: ${validActions.join(", ")}`));
    return;
  }

  // goes through init() so a legacy encrypted config.json is migrated first
  const { config: configObj } = await init({ silent: true });

  switch (action) {
    case "enable": {
      configObj.debug = true;
      await saveConfig(configObj);
      console.log(colors.green("✓ Debug mode enabled."));
      console.log(
        colors.dim("  Advanced troubleshooting features are now available."),
      );
      break;
    }

    case "disable": {
      configObj.debug = false;
      await saveConfig(configObj);
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
