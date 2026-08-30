import { Client, ClientChannel } from "ssh2";

class ShellSession {
  private channel: ClientChannel | null = null;
  private buffer = "";

  isOpen(): boolean {
    return this.channel !== null;
  }

  start(client: Client): Promise<void> {
    if (this.channel) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      client.shell({ term: "xterm-256color", rows: 30, cols: 100 }, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }

        this.channel = stream;
        stream.on("data", (chunk: Buffer) => {
          this.buffer += chunk.toString("utf8");
        });
        stream.stderr.on("data", (chunk: Buffer) => {
          this.buffer += chunk.toString("utf8");
        });
        stream.on("close", () => {
          this.channel = null;
        });

        resolve();
      });
    });
  }

  write(input: string): void {
    if (!this.channel) {
      throw new Error("Shell session is not open. Call start_shell first.");
    }
    this.channel.write(input);
  }

  readOutput(): string {
    const output = this.buffer;
    this.buffer = "";
    return output;
  }

  close(): void {
    if (this.channel) {
      this.channel.end();
      this.channel = null;
    }
  }
}

export default ShellSession;
