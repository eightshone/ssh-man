import transformLogs from "../../utils/transformLogs";
import init from "../functions/init";

async function logs() {
  const { logs } = await init({ silent: true });

  transformLogs(logs).forEach((lg) => {
    console.log(lg);
  });
}

export default logs;
