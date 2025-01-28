import { Spinner } from "yocto-spinner";
import { config, log } from "../../utils/types";
import { CONFIG_DIR, VERSION } from "../../utils/consts";
import saveFile from "../../utils/saveFile";
import { nanoid } from "nanoid";
import compareVersions from "../../utils/compareVersions";

async function migrate(
  config: config,
  logs: log[],
  spinner: Spinner
): Promise<[config, log[]]> {
  let configObj = { ...config };
  let logsObj = [...logs];
  spinner.text = "Migrating configs…";

  if (!configObj.version || compareVersions("0.1.1", configObj.version) === 1) {
    let missingId: boolean = false;
    // assign server ids
    configObj.servers.forEach((srv, index) => {
      if (!srv.id) {
        missingId = true;
        configObj.servers[index].id = nanoid();
      }
    });

    if (missingId) {
      // this will only work for certain pre logs integrations version
      logsObj = [];
      configObj.recentServers = [];
    }

    // starting from this version a fallback server name is kept in the logs
    const servers = {};
    configObj.servers.forEach((srv) => {
      servers[srv.id] = srv.name;
    });
    logsObj = logsObj.map((lg) => ({ ...lg, serverName: servers[lg.server] }));
  }
  configObj.version = VERSION;
  await saveFile(`${CONFIG_DIR}/config.json`, configObj);
  await saveFile(`${CONFIG_DIR}/logs.json`, logsObj);
  spinner.text = "Migration complete!";

  return [configObj, logsObj];
}

export default migrate;
