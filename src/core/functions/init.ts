import { existsSync } from "fs";
import yoctoSpinner from "yocto-spinner";
import { nanoid } from "nanoid";
import createFileIfNotExists from "../../utils/createFileIfNotExist";
import { CONFIG_DIR, DEFAULT_CONFIG, VERSION } from "../../utils/consts";
import loadFile from "../../utils/loadFile";
import { config, log } from "../../utils/types";
import compareVersions from "../../utils/compareVersions";
import saveFile from "../../utils/saveFile";
import migrate from "./migrate";

async function init(): Promise<{ config: config; logs: log[] }> {
  const configFile = `${CONFIG_DIR}/config.json`;
  const logsFile = `${CONFIG_DIR}/logs.json`;
  let spinner = yoctoSpinner({ text: "Checking config files…" }).start();
  // check for app config files
  if (!existsSync(configFile) || !existsSync(logsFile)) {
    spinner.text = "Creating config files…";
    await createFileIfNotExists(configFile, JSON.stringify(DEFAULT_CONFIG));
    await createFileIfNotExists(logsFile, "[]");
    spinner.text = "Config files created!";
  }

  // todo: add config files validations

  // load config and logs
  spinner.text = "Loading config files…";
  let configObj: config = await loadFile(`${CONFIG_DIR}/config.json`),
    logsObj: log[] = await loadFile(`${CONFIG_DIR}/logs.json`);
  spinner.text = "Config files loaded!";

  spinner.text = "Checking config compatibility…";
  if (
    !configObj.version ||
    (!!configObj.version && compareVersions(VERSION, configObj.version) === 1)
  ) {
    [configObj, logsObj] = await migrate(configObj, logsObj, spinner);
  }

  spinner?.success("App started!");

  return {
    config: configObj,
    logs: logsObj,
  };
}

export default init;
