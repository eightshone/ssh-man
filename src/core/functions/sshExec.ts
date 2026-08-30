import { Client } from "ssh2";

export type execResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
};

function execCommand(
  client: Client,
  command: string,
  opts: { cwd?: string } = {},
): Promise<execResult> {
  const fullCommand = opts.cwd
    ? `cd ${JSON.stringify(opts.cwd)} && ${command}`
    : command;

  return new Promise((resolve, reject) => {
    client.exec(fullCommand, (err, channel) => {
      if (err) {
        reject(err);
        return;
      }

      let stdout = "";
      let stderr = "";
      let exitCode: number | null = null;

      channel
        .on("data", (chunk: Buffer) => {
          stdout += chunk.toString("utf8");
        })
        .on("exit", (code: number | null) => {
          exitCode = code;
        })
        .on("close", () => {
          resolve({ stdout, stderr, exitCode });
        })
        .stderr.on("data", (chunk: Buffer) => {
          stderr += chunk.toString("utf8");
        });
    });
  });
}

export default execCommand;
