import { existsSync } from "fs";
import yoctoSpinner from "yocto-spinner";
import createFileIfNotExists from "../utils/createFileIfNotExist";
import { homedir } from "os";

function init() {
  const serversFile = `${homedir()}/.sshman/servers.json`;
  let spinner = null;
  if (!existsSync(serversFile)) {
    console.log(
      "This seems like your first time here. We will initialize things for you."
    );
    spinner = yoctoSpinner({ text: "Creating config files…" }).start();
    createFileIfNotExists(serversFile);
  }

  spinner?.success("Done!");
}

export default init;
