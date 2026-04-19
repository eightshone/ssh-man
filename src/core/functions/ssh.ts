import { Client } from "ssh2";
import yoctoSpinner from "yocto-spinner";
import colors from "yoctocolors-cjs";
import { server } from "../../utils/types";
import { readFileSync } from "fs";

// this function creates a raw input ssh connection

function sshConnection(
  sshConfig: server,
  unref: boolean = false,
  isTUI: boolean = false,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const spinner = yoctoSpinner({ text: "Connecting to server…" }).start();
    const client = new Client();
    const config: any = { ...sshConfig };
    if (config.usePassword === false) {
      config.privateKey = readFileSync(config.privateKey);
    }

    client
      .on("close", () => {
        resolve(); // resolve the promise when the connection closes
      })
      .on("error", (err) => {
        spinner.error(colors.red("Connection error!"));
        if (isTUI) {
          reject(err);
        } else {
          console.log("Error details", err.message);
          resolve();
        }
      })
      .on("ready", function () {
        spinner.success(colors.green("Connection ready!"));
        this.shell(
          {
            term: process.env.TERM ?? "xterm-256color",
            rows: process.stdout.rows,
            cols: process.stdout.columns,
          },
          (err, stream) => {
            if (err) {
              reject(err); // reject the promise if shell creation fails
              return;
            }

            stream.on("close", () => {
              if (unref) {
                process.stdin.unref(); // unless it is specified for a certain usecase, this line will terminate the whole application
              }
              this.end(); // close the connection
            });

            process.stdin.setRawMode(true);
            process.stdin.pipe(stream);
            stream.pipe(process.stdout);

            process.stdout.on("resize", () => {
              stream.setWindow(
                process.stdout.rows,
                process.stdout.columns,
                0,
                0,
              );
            });
          },
        );
      })
      .connect(config);
  });
}

export default sshConnection;
