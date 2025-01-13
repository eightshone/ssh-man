import { existsSync } from "fs";
import yoctoSpinner from "yocto-spinner";
import createFileIfNotExists from "../utils/createFileIfNotExist";
import { homedir } from "os";
import { DEFAULT_CONFIG } from "../utils/consts";

async function init() {
  const configFile = `${homedir()}/.sshman/config.json`;
  const logsFile = `${homedir()}/.sshman/logs.json`;
  let spinner = yoctoSpinner({ text: "Checking config files…" }).start();
  // check for app config files
  if (!existsSync(configFile) || !existsSync(logsFile)) {
    spinner.text = "Creating config files…";
    await createFileIfNotExists(configFile, JSON.stringify(DEFAULT_CONFIG));
    await createFileIfNotExists(logsFile, "[]");
    spinner.text = "Config files created!";
  }

  // todo: add config files validations

  spinner?.success("App started!");
}

export default init;
