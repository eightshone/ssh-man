import { existsSync, promises as fs } from "fs";
import dayjs from "dayjs";
import yoctoSpinner from "yocto-spinner";
import createFileIfNotExists from "../../utils/createFileIfNotExist";
import { CONFIG_DIR, DEFAULT_CONFIG, VERSION } from "../../utils/consts";
import loadFile from "../../utils/loadFile";
import { config, log } from "../../utils/types";
import compareVersions from "../../utils/compareVersions";
import migrate from "./migrate";
import isSameVersion from "./isSameVersion";
import showUpdateMessage from "./showUpdateMessage";
import { isPlainJSON } from "../../utils/crypto";
import saveFile from "../../utils/saveFile";

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
    if (!silent && spinner) {
      spinner.text = "Creating config files…";
    }
    await createFileIfNotExists(
      configFile,
      JSON.stringify(DEFAULT_CONFIG),
      true
    );
    await createFileIfNotExists(logsFile, "[]");
    if (!silent && spinner) {
      spinner.text = "Config files created!";
    }
  }

  // todo: add config files validations

  // load config and logs
  if (!silent && spinner) {
    spinner.text = "Loading config files…";
  }
  let configObj: config = await loadFile(`${CONFIG_DIR}/config.json`, true),
    logsObj: log[] = await loadFile(`${CONFIG_DIR}/logs.json`);
  if (!silent && spinner) {
    spinner.text = "Config files loaded!";
    spinner.text = "Checking config compatibility…";
  }

  // migrate plain-text config files to encrypted format
  const rawContent = await fs.readFile(configFile, "utf8");
  if (isPlainJSON(rawContent)) {
    if (!silent && spinner) {
      spinner.text = "Encrypting config file…";
    }
    await saveFile(configFile, configObj, undefined, true);
    if (!silent && spinner) {
      spinner.text = "Config file encrypted!";
    }
  }

  // migrate config files
  if (
    !configObj.version ||
    (!!configObj.version && compareVersions(VERSION, configObj.version) === 1)
  ) {
    if (!silent && spinner) {
      spinner.text = "Migrating config files…";
    }
    [configObj, logsObj] = await migrate(configObj, logsObj, spinner);
    if (!silent && spinner) {
      spinner.text = "Config files migrated!";
    }
  }

  // check for updates (at most once per day)
  const lastCheckFile = `${CONFIG_DIR}/.last-update-check`;
  let shouldCheckUpdate = true;

  if (existsSync(lastCheckFile)) {
    try {
      const lastCheck = await fs.readFile(lastCheckFile, "utf8");
      if (dayjs().isSame(dayjs(lastCheck), "day")) {
        shouldCheckUpdate = false;
      }
    } catch {
      // corrupt file or invalid date, re-check
    }
  }

  if (shouldCheckUpdate) {
    if (!silent && spinner) {
      spinner.text = "Checking for updates…";
    }
    const [isUptodate, manager] = await isSameVersion();
    await fs.writeFile(lastCheckFile, dayjs().toISOString(), "utf8");

    if (!silent && spinner) {
      spinner.success("App started!");
    }

    showUpdateMessage(isUptodate, manager, true);
  } else {
    if (!silent && spinner) {
      spinner.success("App started!");
    }
  }

  return {
    config: configObj,
    logs: logsObj,
  };
}

export default init;
