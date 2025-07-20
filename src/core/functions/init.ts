import { existsSync } from "fs";
import yoctoSpinner from "yocto-spinner";
import createFileIfNotExists from "../../utils/createFileIfNotExist";
import { CONFIG_DIR, DEFAULT_CONFIG, VERSION } from "../../utils/consts";
import loadFile from "../../utils/loadFile";
import { config, log } from "../../utils/types";
import compareVersions from "../../utils/compareVersions";
import migrate from "./migrate";
import isSameVersion from "./isSameVersion";
import showUpdateMessage from "./showUpdateMessage";

type options = {
  silent?: boolean;
};

async function init(
  options: options = { silent: false }
): Promise<{ config: config; logs: log[] }> {
  const { silent } = options;
  const configFile = `${CONFIG_DIR}/config.json`;
  const logsFile = `${CONFIG_DIR}/logs.json`;

  let spinner;
  if (!silent) {
    spinner = yoctoSpinner({ text: "Checking config files…" }).start();
  }

  // check for app config files
  if (!existsSync(configFile) || !existsSync(logsFile)) {
    if (!silent) {
      spinner.text = "Creating config files…";
    }
    await createFileIfNotExists(configFile, JSON.stringify(DEFAULT_CONFIG));
    await createFileIfNotExists(logsFile, "[]");
    if (!silent) {
      spinner.text = "Config files created!";
    }
  }

  // todo: add config files validations

  // load config and logs
  if (!silent) {
    spinner.text = "Loading config files…";
  }
  let configObj: config = await loadFile(`${CONFIG_DIR}/config.json`),
    logsObj: log[] = await loadFile(`${CONFIG_DIR}/logs.json`);
  if (!silent) {
    spinner.text = "Config files loaded!";
  }

  if (!silent) {
    spinner.text = "Checking config compatibility…";
  }
  if (
    !configObj.version ||
    (!!configObj.version && compareVersions(VERSION, configObj.version) === 1)
  ) {
    [configObj, logsObj] = await migrate(configObj, logsObj, spinner);
  }

  const [isUptodate, manager] = await isSameVersion();

  if (!silent) {
    spinner?.success("App started!");
  }

  showUpdateMessage(isUptodate, manager, true);

  return {
    config: configObj,
    logs: logsObj,
  };
}

export default init;
