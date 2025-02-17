import transformLogs from "../../utils/transformLogs";
import init from "../functions/init";
import interactiveLogs from "../ui/logs";

async function logs(options) {
  const { interactive, search } = options;

  const { logs } = await init({ silent: true });

  if (interactive) {
    interactiveLogs(logs);
    console.clear();
  } else {
    transformLogs(logs)
      .filter(
        (lg) => (search && search.length && lg.includes(search)) || !search
      )
      .forEach((lg) => {
        console.log(lg);
      });
  }
}

export default logs;
