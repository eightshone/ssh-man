import search from "@inquirer/search";
import colors from "yoctocolors-cjs";
import { log, menu } from "../../../utils/types";
import transformLogs from "../../../utils/transformLogs";
import { logsTheme } from "../../../utils/themes";

async function scrollableList(logs: log[] = []): Promise<[menu]> {
  console.clear();
  console.log(colors.blueBright("📰 SERVER CONNECTION LOGS"));
  await search({
    message: "Search:",
    source: async (input, { signal }) => {
      await setTimeout(() => {}, 300);
      if (signal.aborted) return [];

      return transformLogs(logs)
        .filter((lg) => (input && input.length && lg.includes(input)) || !input)
        .map((lg) => ({
          name: lg,
          value: null,
        }));
    },
    pageSize: process.stdout.rows - 4,
    theme: logsTheme,
  });

  return ["main"];
}

export default scrollableList;
