import { spawn } from "child_process";
import colors from "yoctocolors-cjs";
import { server } from "../../utils/types";
import buildSshArgs from "../../utils/buildSshArgs";
import buildAskpassEnv from "./askpassEnv";

export type SshTarget = {
  args: string[];
  env: NodeJS.ProcessEnv;
  close: () => void;
};

// verifies the connection works (fails fast on bad credentials/host) and
// returns a reusable {args, env} descriptor for exec/sftp/shell helpers to
// shell out with.
// ponytail: each call below spawns its own `ssh` process rather than
// multiplexing over one socket, add ControlMaster/ControlPath if per-call
// latency in the MCP tools becomes a problem
export function connectClient(sshConfig: server, oneOffPassword?: string): Promise<SshTarget> {
  const args = buildSshArgs(sshConfig);
  const { env, cleanup } = buildAskpassEnv(sshConfig, oneOffPassword);

  return new Promise((resolve, reject) => {
    const probe = spawn("ssh", [...args, "exit"], {
      stdio: ["ignore", "ignore", "pipe"],
      env,
    });

    let stderr = "";
    probe.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString("utf8")));
    probe.on("error", (err) => {
      cleanup();
      reject(err);
    });
    probe.on("close", (code) => {
      if (code === 0) {
        resolve({ args, env, close: cleanup });
      } else {
        cleanup();
        reject(new Error(stderr.trim() || `ssh exited with code ${code}`));
      }
    });
  });
}

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
