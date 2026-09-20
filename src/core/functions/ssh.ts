import { spawn } from "child_process";
import colors from "yoctocolors-cjs";
import { server } from "../../utils/types";
import buildSshArgs from "../../utils/buildSshArgs";
import buildAskpassEnv from "./askpassEnv";

// opens a raw, interactive ssh session. stdio is handed straight to the
// real ssh client, so it owns the PTY, resize, and escape sequences itself
function sshConnection(
  sshConfig: server,
  oneOffPassword?: string,
  isTUI: boolean = false,
): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(
      colors.cyan(`Connecting to ${sshConfig.name || sshConfig.host}…`),
    );

    const args = buildSshArgs(sshConfig);
    const { env, cleanup } = buildAskpassEnv(sshConfig, oneOffPassword);

    const child = spawn("ssh", args, { stdio: "inherit", env });

    child.on("error", (err) => {
      cleanup();
      console.log(colors.red("Connection error!"), err.message);
      if (isTUI) {
        reject(err);
      } else {
        resolve();
      }
    });

    child.on("close", () => {
      cleanup();
      resolve();
    });
  });
}

export default sshConnection;
