import search from "@inquirer/search";
import colors from "yoctocolors-cjs";
import { log, menu } from "../../utils/types";
import transformLogs from "../../utils/transformLogs";
import { logsTheme } from "../../utils/themes";

async function interactiveLogs(logs: log[] = []): Promise<[menu]> {
  console.clear();
  console.log(colors.blueBright("📰 SERVER CONNECTION LOGS"));
  await search({
    message: "Search:",
    source: async (input, { signal }) => {
      if (logs.length === 0) {
        return [
          {
            name: "📭 No server connections have been logged!",
            value: null,
          },
        ];
      }
      await setTimeout(() => {}, 300);
      if (signal.aborted) return [];

      const filteredLogs = transformLogs(logs)
        .filter((lg) => (input && input.length && lg.includes(input)) || !input)
        .map((lg) => ({
          name: lg,
          value: null,
        }));

      return filteredLogs.length
        ? filteredLogs
        : [
            {
              name: "📭 No logs matched your search query!",
              value: null,
            },
          ];
    },
    pageSize: process.stdout.rows - 4,
    theme: logsTheme,
  });

  return ["main"];
}

export default interactiveLogs;
