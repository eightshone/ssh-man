import { existsSync } from "fs";
import yoctoSpinner from "yocto-spinner";
import createFileIfNotExists from "../utils/createFileIfNotExist";
import { configDir, DEFAULT_CONFIG } from "../utils/consts";
import loadFile from "../utils/loadFile";
import { config, json, log } from "../utils/types";

async function init(): Promise<{ config: config; logs: log[] }> {
  const configFile = `${configDir}/config.json`;
  const logsFile = `${configDir}/logs.json`;
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
  const configObj = await loadFile(`${configDir}/config.json`);
  const logsObj = await loadFile(`${configDir}/logs.json`);
  spinner.text = "Config files loaded!";

  spinner?.success("App started!");

  return {
    config: configObj as config,
    logs: logsObj as log[],
  };
}

export default init;
