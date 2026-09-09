import { spawn } from "child_process";
import { SshTarget } from "./ssh";

export type execResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
};

function execCommand(
  target: SshTarget,
  command: string,
  opts: { cwd?: string } = {},
): Promise<execResult> {
  const fullCommand = opts.cwd
    ? `cd ${JSON.stringify(opts.cwd)} && ${command}`
    : command;

  return new Promise((resolve, reject) => {
    const child = spawn("ssh", [...target.args, fullCommand], {
      stdio: ["ignore", "pipe", "pipe"],
      env: target.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString("utf8")));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString("utf8")));
    child.on("error", reject);
    child.on("close", (exitCode) => resolve({ stdout, stderr, exitCode }));
  });
}

export default execCommand;
