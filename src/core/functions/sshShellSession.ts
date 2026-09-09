import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { SshTarget } from "./ssh";

class ShellSession {
  private child: ChildProcessWithoutNullStreams | null = null;
  private buffer = "";

  isOpen(): boolean {
    return this.child !== null;
  }

  start(target: SshTarget): Promise<void> {
    if (this.child) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      // -tt forces a pseudo-tty even though stdio is piped, matching the
      // interactive shell ssh2's client.shell() used to allocate
      const child = spawn("ssh", ["-tt", ...target.args], {
        stdio: ["pipe", "pipe", "pipe"],
        env: target.env,
      });

      this.child = child;
      child.stdout.on("data", (chunk: Buffer) => (this.buffer += chunk.toString("utf8")));
      child.stderr.on("data", (chunk: Buffer) => (this.buffer += chunk.toString("utf8")));
      child.on("close", () => {
        this.child = null;
      });
      child.on("error", (err) => {
        this.child = null;
        reject(err);
      });

      resolve();
    });
  }

  write(input: string): void {
    if (!this.child) {
      throw new Error("Shell session is not open. Call start_shell first.");
    }
    this.child.stdin.write(input);
  }

  readOutput(): string {
    const output = this.buffer;
    this.buffer = "";
    return output;
  }

  close(): void {
    if (this.child) {
      this.child.kill();
      this.child = null;
    }
  }
}

export default ShellSession;
