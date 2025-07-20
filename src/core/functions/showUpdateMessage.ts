import colors from "yoctocolors-cjs";
import { UPDATE_COMMANDS } from "../../utils/consts";

function showUpdateMessage(
  isUptodate: boolean,
  manager: "npm" | "yarn" | "pnpm",
  warningOnly: boolean = false
) {
  if (isUptodate && !warningOnly) {
    console.log(
      "\n" +
        colors.bgCyan(colors.black(" INFORMATION ")) +
        " → SSH MANAGER is up to date."
    );
  }

  if (!isUptodate) {
    console.log(
      "\n" +
        colors.bgYellow(colors.black(" NOTICE! ")) +
        colors.yellow(
          " → SSH MANAGER is *NOT* up to date.\nTo install the latest version use the following command:\n\n    " +
            colors.bgYellow(
              colors.black(" " + UPDATE_COMMANDS[manager] + " ")
            ) +
            "\n"
        )
    );
  }
}

export default showUpdateMessage;
