import { ansi } from "../../utils/tui/index";
import transformLogs from "../../utils/transformLogs";
import init from "../functions/init";
import interactiveLogs from "../ui/logs";

async function logs(options) {
  const { interactive, search } = options;

  const { logs } = await init({ silent: true });

  if (interactive) {
    process.stdout.write(ansi.altScreenEnter());
    await interactiveLogs(logs);
    process.stdout.write(ansi.altScreenExit());
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
