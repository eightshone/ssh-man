import { spawn } from "child_process";
import colors from "yoctocolors-cjs";
import select from "@inquirer/select";
import password from "@inquirer/password";
import { server } from "../../utils/types";
import buildSshArgs from "../../utils/buildSshArgs";
import { getServerPassword } from "../../utils/secret";
import buildAskpassEnv from "./askpassEnv";

// a password server whose secret can't come from the keyring (backend down,
// or never stored) would otherwise fail with "Permission denied": ask for
// the password once, or fall back to ssh's default keys
async function resolveAuth(
  sshConfig: server,
  oneOffPassword?: string,
): Promise<[server, string?]> {
  if (sshConfig.usePassword !== true || oneOffPassword !== undefined) {
    return [sshConfig, oneOffPassword];
  }
  const stored = await getServerPassword(sshConfig.id);
  if (stored.ok && stored.password) return [sshConfig];

  const choice = await select({
    message: `${stored.ok ? "No saved password for this server" : "OS keyring unavailable"}. How do you want to connect?`,
    choices: [
      { name: "Enter password", value: "password" },
      { name: "Use default SSH key", value: "key" },
    ],
  });
  if (choice === "key") {
    // empty privateKey: no -i, so ~/.ssh/config and ssh's defaults pick the key
    return [{ ...sshConfig, usePassword: false, privateKey: "" }];
  }
  return [sshConfig, await password({ message: "Password:", mask: true })];
}

// opens a raw, interactive ssh session. stdio is handed straight to the
// real ssh client, so it owns the PTY, resize, and escape sequences itself
async function sshConnection(
  sshConfig: server,
  oneOffPassword?: string,
  isTUI: boolean = false,
): Promise<void> {
  const [target, pw] = await resolveAuth(sshConfig, oneOffPassword);

  return new Promise((resolve, reject) => {
    console.log(
      colors.cyan(`Connecting to ${target.name || target.host}…`),
    );

    const args = buildSshArgs(target);
    const { env, cleanup } = buildAskpassEnv(target, pw);

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
