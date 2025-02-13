import stringPadding from "./stringPadding";
import { log } from "./types";

function transformLogs(logs: log[]) {
  return logs.map(
    (lg) =>
      `${lg.time} - ${stringPadding(
        lg.serverName,
        process.stdout.columns - 24
      )}`
  );
}

export default transformLogs;
