import { spawn } from "child_process";
import execCommand from "./sshExec";
import { SshTarget } from "./ssh";

export type directoryEntry = {
  name: string;
  type: "file" | "directory" | "symlink" | "other";
  size: number;
  mtime: number;
};

export async function readRemoteFile(
  target: SshTarget,
  path: string,
): Promise<string> {
  const { stdout, stderr, exitCode } = await execCommand(
    target,
    `cat -- ${JSON.stringify(path)}`,
  );
  if (exitCode !== 0) {
    throw new Error(stderr.trim() || `cat exited with code ${exitCode}`);
  }
  return stdout;
}

export function writeRemoteFile(
  target: SshTarget,
  path: string,
  content: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("ssh", [...target.args, `cat > ${JSON.stringify(path)}`], {
      stdio: ["pipe", "ignore", "pipe"],
      env: target.env,
    });

    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString("utf8")));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(stderr.trim() || `write failed with code ${code}`)),
    );
    child.stdin.end(content, "utf8");
  });
}

// ponytail: uses GNU find's -printf for structured output instead of a raw
// SFTP stat, assumes a Linux/GNU-findutils remote
export async function listRemoteDirectory(
  target: SshTarget,
  path: string,
): Promise<directoryEntry[]> {
  const format = "%f\\t%y\\t%s\\t%T@";
  const { stdout, stderr, exitCode } = await execCommand(
    target,
    `find ${JSON.stringify(path)} -mindepth 1 -maxdepth 1 -printf '${format}\\n'`,
  );
  if (exitCode !== 0) {
    throw new Error(stderr.trim() || `find exited with code ${exitCode}`);
  }

  return stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [name, type, size, mtime] = line.split("\t");
      return {
        name,
        type:
          type === "d"
            ? "directory"
            : type === "l"
              ? "symlink"
              : type === "f"
                ? "file"
                : "other",
        size: Number(size),
        mtime: Math.floor(Number(mtime)),
      };
    });
}
